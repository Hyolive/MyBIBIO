import { createServer } from '../server';

let cachedApp: any;

export default async (req: any, res: any) => {
  try {
    console.log(`Vercel function called: ${req.url}`);
    if (!cachedApp) {
      console.log("Initializing Express app...");
      cachedApp = await createServer();
    }
    return cachedApp(req, res);
  } catch (error: any) {
    console.error("VERCEL API CRASH:", error);
    res.status(500).json({ 
      error: "FUNCTION_CRASHED", 
      message: error.message,
      stack: error.stack 
    });
  }
};
