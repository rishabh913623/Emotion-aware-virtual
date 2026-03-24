import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
