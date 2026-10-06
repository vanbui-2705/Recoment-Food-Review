import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
describe("attributable data reports and audited administration", () => {
  const app = buildApp({ logger: false }),
    suffix = randomUUID(),
    users: string[] = [];
  let owner: { authorization: string },
    other: { authorization: string },
    admin: { authorization: string };
  const payload = () => ({
    target: { kind: "PLACE", source: "google", id: `fixture_${suffix}` },
    reason: "WRONG_ADDRESS",
    note: `report ${suffix}`,
    idempotencyKey: randomUUID(),
  });
  beforeAll(async () => {
    await app.ready();
    for (const prefix of ["owner", "other", "admin"]) {
      const email = `${prefix}-report-${suffix}@test.local`,
        password = "report-test-password";
      const registered = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password, displayName: "Report Test" },
      });
      expect(registered.statusCode).toBe(201);
      const id = registered.json().data.user.id;
      users.push(id);
      if (prefix === "admin")
        await app.prisma.user.update({ where: { id }, data: { role: "ADMIN" } });
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password },
      });
      const headers = { authorization: `Bearer ${login.json().data.accessToken}` };
      if (prefix === "owner") owner = headers;
      else if (prefix === "other") other = headers;
      else admin = headers;
    }
  });
  afterAll(async () => {
    await app.prisma.dataReport.deleteMany({ where: { targetId: `fixture_${suffix}` } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });
  it("keeps reports private, idempotent and rejects malformed source references", async () => {
    const body = payload();
    const first = await app.inject({
      method: "POST",
      url: "/users/me/data-reports",
      headers: owner,
      payload: body,
      remoteAddress: "10.10.10.1",
    });
    expect(first.statusCode, first.body).toBe(200);
    const id = first.json().data.id;
    const replay = await app.inject({
      method: "POST",
      url: "/users/me/data-reports",
      headers: owner,
      payload: body,
      remoteAddress: "10.10.10.1",
    });
    expect(replay.json().data.id).toBe(id);
    expect(replay.json().data).not.toHaveProperty("inputHash");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/users/me/data-reports",
          headers: owner,
          payload: { ...body, note: "changed" },
          remoteAddress: "10.10.10.1",
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await app.inject({ method: "GET", url: `/users/me/data-reports/${id}`, headers: other }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: "/admin/data-reports", headers: owner })).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/users/me/data-reports",
          headers: owner,
          payload: {
            ...payload(),
            target: { kind: "PLACE", source: "google", id: "https://evil.test/?key=secret" },
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/users/me/data-reports",
          headers: owner,
          payload: { ...payload(), target: { kind: "OFFER", id: randomUUID() } },
          remoteAddress: "10.10.10.2",
        })
      ).statusCode,
    ).toBe(404);
  });
  it("resolves and reopens with a reason, rejects races and writes a redacted audit atomically", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/users/me/data-reports",
      headers: owner,
      payload: payload(),
      remoteAddress: "10.10.10.3",
    });
    const report = created.json().data,
      path = `/admin/data-reports/${report.id}/review`;
    const review = {
      status: "RESOLVED",
      reason: `sensitive reviewer note ${suffix}`,
      expectedUpdatedAt: report.updatedAt,
    };
    expect(
      (await app.inject({ method: "PUT", url: path, headers: owner, payload: review })).statusCode,
    ).toBe(403);
    const raced = await Promise.all([
      app.inject({ method: "PUT", url: path, headers: admin, payload: review }),
      app.inject({
        method: "PUT",
        url: path,
        headers: admin,
        payload: { ...review, status: "DISMISSED" },
      }),
    ]);
    expect(raced.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(await app.prisma.reportReview.count({ where: { reportId: report.id } })).toBe(1);
    const log = await app.prisma.adminAudit.findFirstOrThrow({
      where: { targetId: report.id, action: "REPORT_REVIEW" },
    });
    expect(JSON.stringify(log.metadata)).not.toContain(suffix);
    const current = (
      await app.inject({ method: "GET", url: `/admin/data-reports/${report.id}`, headers: admin })
    ).json().data;
    expect(
      (
        await app.inject({
          method: "PUT",
          url: path,
          headers: admin,
          payload: { status: "OPEN", reason: " ", expectedUpdatedAt: current.updatedAt },
        })
      ).statusCode,
    ).toBe(400);
    const reopened = await app.inject({
      method: "PUT",
      url: path,
      headers: admin,
      payload: {
        status: "OPEN",
        reason: "New information received",
        expectedUpdatedAt: current.updatedAt,
      },
    });
    expect(reopened.statusCode).toBe(200);
    expect(new Date(reopened.json().data.updatedAt).getTime()).toBeGreaterThan(
      new Date(current.updatedAt).getTime(),
    );
    expect(await app.prisma.reportReview.count({ where: { reportId: report.id } })).toBe(2);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/users/me/data-reports/${report.id}`,
          headers: owner,
        })
      ).json().data.status,
    ).toBe("OPEN");
  });
  it("limits spam without claiming an unaccepted report was saved", async () => {
    const body = payload();
    for (let i = 0; i < 5; i++)
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/users/me/data-reports",
            headers: owner,
            payload: body,
            remoteAddress: "10.10.10.4",
          })
        ).statusCode,
      ).toBe(200);
    const blocked = await app.inject({
      method: "POST",
      url: "/users/me/data-reports",
      headers: owner,
      payload: { ...body, idempotencyKey: randomUUID() },
      remoteAddress: "10.10.10.4",
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(
      await app.prisma.dataReport.count({
        where: { userId: users[0], idempotencyKey: `${users[0]}:${body.idempotencyKey}` },
      }),
    ).toBe(1);
  });
});
