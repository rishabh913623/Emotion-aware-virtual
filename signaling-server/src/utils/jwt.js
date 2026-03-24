import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "4HVikQSXosoN1bdGvWssVKioUNwIqFTPNBz4nF3T88sz/JihDwqHMZFAkYIWS6oJ";

export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
