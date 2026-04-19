import { createServer } from '../server';

let cachedApp: any;

export default async (req: any, res: any) => {
  console.log(`Vercel function called: ${req.url}`);
  if (!cachedApp) {
    console.log("Initializing Express app...");
    cachedApp = await createServer();
  }
  return cachedApp(req, res);
};
