import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index.js';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Lỗi hệ thống máy chủ';

  const response: ApiResponse<null> = {
    success: false,
    status: statusCode,
    message,
    data: null,
  };

  console.error(`[Error ${statusCode}]:`, err);
  res.status(statusCode).json(response);
};
