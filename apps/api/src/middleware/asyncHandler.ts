import { Request, Response, NextFunction, RequestHandler } from 'express';

// Express 4 doesn't auto-catch rejected promises from async handlers — an
// uncaught rejection here crashes the whole process (Node 15+ default).
// Wrap every route so a DB error becomes a 500 response, not a downed server.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
