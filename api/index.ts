import { createServer } from '../server.js';

let cachedApp: any;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      cachedApp = await createServer();
    }
    
    // Ensure the Serverless Function stays alive until Express finishes
    return new Promise((resolve, reject) => {
      res.once('finish', resolve);
      res.once('error', reject);
      cachedApp(req, res);
    });
  } catch (error: any) {
    console.error("VERCEL API CRASH:", error);
    res.status(500).json({ 
      error: "FUNCTION_CRASHED", 
      message: error.message,
      stack: error.stack 
    });
  }
}
