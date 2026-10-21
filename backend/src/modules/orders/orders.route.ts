import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@fastify/type-provider-typebox";
import { promises as fs } from "node:fs";
import path from "node:path";

export type OrderItem = {
  id: string;
  dishId?: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  sugar?: string;
  ice?: string;
  spice?: string;
  toppings?: string[];
  note?: string;
  image?: string;
};

export type Order = {
  id: string;
  code: string;
  userId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  note?: string;
  paymentMethod: "COD" | "VIETQR";
  status: "CONFIRMED" | "PREPARING" | "DELIVERING" | "COMPLETED" | "CANCELLED";
  estimatedMinutes: number;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

async function ensureDataFile(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(ORDERS_FILE);
  } catch {
    await fs.writeFile(ORDERS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

async function readOrders(): Promise<Order[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(ORDERS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeOrders(orders: Order[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

export const orderRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // 1. Create a new order
  app.post(
    "/orders",
    {
      schema: {
        body: Type.Object({
          restaurantId: Type.String(),
          restaurantName: Type.String(),
          restaurantAddress: Type.Optional(Type.String()),
          items: Type.Array(
            Type.Object({
              id: Type.String(),
              dishId: Type.Optional(Type.String()),
              name: Type.String(),
              price: Type.Number(),
              quantity: Type.Number(),
              size: Type.Optional(Type.String()),
              sugar: Type.Optional(Type.String()),
              ice: Type.Optional(Type.String()),
              spice: Type.Optional(Type.String()),
              toppings: Type.Optional(Type.Array(Type.String())),
              note: Type.Optional(Type.String()),
              image: Type.Optional(Type.String()),
            }),
          ),
          subtotal: Type.Number(),
          deliveryFee: Type.Number(),
          totalAmount: Type.Number(),
          recipientName: Type.String(),
          recipientPhone: Type.String(),
          deliveryAddress: Type.String(),
          note: Type.Optional(Type.String()),
          paymentMethod: Type.Union([Type.Literal("COD"), Type.Literal("VIETQR")]),
        }),
      },
    },
    async (req, reply) => {
      const user = req.authUser!;
      const body = req.body;
      const code = `ORD-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      const newOrder: Order = {
        id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        code,
        userId: user.id,
        restaurantId: body.restaurantId,
        restaurantName: body.restaurantName,
        restaurantAddress: body.restaurantAddress || "",
        items: body.items,
        subtotal: body.subtotal,
        deliveryFee: body.deliveryFee,
        totalAmount: body.totalAmount,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        deliveryAddress: body.deliveryAddress,
        note: body.note || "",
        paymentMethod: body.paymentMethod,
        status: "CONFIRMED",
        estimatedMinutes: 25,
        driverName: "Nguyễn Văn Hùng",
        driverPhone: "0912 345 678",
        driverPlate: "59P1-882.91",
        createdAt: now,
        updatedAt: now,
      };

      const orders = await readOrders();
      orders.unshift(newOrder);
      await writeOrders(orders);

      return reply.status(201).send({
        data: {
          order: newOrder,
          message: "Đặt hàng thành công! Quán ăn đang chuẩn bị món cho bạn.",
        },
      });
    },
  );

  // 2. Get my orders
  app.get("/orders/my-orders", async (req) => {
    const user = req.authUser!;
    const orders = await readOrders();
    const userOrders = orders.filter((o) => o.userId === user.id);
    return { data: { orders: userOrders } };
  });

  // 3. Get order detail by ID
  app.get(
    "/orders/:id",
    {
      schema: {
        params: Type.Object({
          id: Type.String(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.authUser!;
      const orders = await readOrders();
      const order = orders.find((o) => o.id === req.params.id && (o.userId === user.id || user.role === "ADMIN"));
      if (!order) {
        return reply.status(404).send({ error: { message: "Không tìm thấy đơn hàng" } });
      }
      return { data: { order } };
    },
  );

  // 4. Cancel order
  app.patch(
    "/orders/:id/cancel",
    {
      schema: {
        params: Type.Object({
          id: Type.String(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.authUser!;
      const orders = await readOrders();
      const index = orders.findIndex((o) => o.id === req.params.id && (o.userId === user.id || user.role === "ADMIN"));
      if (index === -1) {
        return reply.status(404).send({ error: { message: "Không tìm thấy đơn hàng" } });
      }

      if (orders[index].status === "COMPLETED") {
        return reply.status(400).send({ error: { message: "Đơn hàng đã hoàn thành, không thể hủy." } });
      }

      orders[index].status = "CANCELLED";
      orders[index].updatedAt = new Date().toISOString();
      await writeOrders(orders);

      return { data: { order: orders[index], message: "Đã hủy đơn hàng thành công." } };
    },
  );
};
