import argon2 from "argon2";

export function hashPassword(password: string): Promise<string> {
  // Argon2id tự tạo salt và lưu cả tham số/salt trong chuỗi hash trả về.
  // Khi làm login, dùng argon2.verify(passwordHash, password) thay vì hash rồi so sánh.
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}
