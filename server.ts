import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import session from "express-session";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Setup helper
let supabase: any;

export async function createServer() {
  const app = express();
  const PORT = 3000;

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("FATAL: SUPABASE_URL or SUPABASE_KEY missing in environments.");
  }

  const formattedUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`;
  
  if (!supabase) {
    try {
      supabase = createClient(formattedUrl, supabaseKey);
    } catch (e) {
      console.error("Failed to initialize Supabase client:", e);
    }
  }

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(session({
    secret: "bibio-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  // --- Auto Seed Admin ---
  const seedAdmin = async () => {
    try {
      // Only seed once in a while or based on a flag to avoid slow requests
      if (process.env.SKIP_SEED === "true") return;
      
      console.log("Ensuring default admin exists...");
      const { error } = await supabase
        .from('admins')
        .upsert([
          { 
            name: 'Administrateur', 
            email: 'admin@bibio.univ', 
            password: 'admin123' 
          }
        ], { onConflict: 'email' });

      if (error) {
        console.error("Admin seeding failed:", error.message);
      } else {
        console.log("Admin seeded/verified: admin@bibio.univ");
      }
    } catch (e) {
      console.error("Critical seeding error:", e);
    }
  };
  if (!process.env.VERCEL) {
    seedAdmin();
  }

  // --- API Routes ---

  // Health Check
  app.get(["/api/health", "/api/"], (req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      supabase: !!supabaseUrl ? "configured" : "missing",
      vercel: !!process.env.VERCEL
    });
  });

  // Auth
  app.post("/api/auth/admin/login", async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();
    
    console.log(`Login attempt for: ${email}`);
    
    try {
      const { data: admin, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error("Supabase Error during login:", error);
        return res.status(500).json({ success: false, message: "Erreur technique Supabase : " + error.message });
      }

      if (!admin) {
        console.warn(`User not found in Supabase: ${email}`);
        return res.status(401).json({ success: false, message: "ÉCHEC : Administrateur non trouvé dans Supabase. Avez-vous créé la table et l'utilisateur ?" });
      }

      console.log(`Found admin: ${admin.name}, comparing passwords...`);

      // Check plain text password directly
      if (admin.password === password) {
        console.log("Login successful!");
        res.json({ success: true, user: { id: admin.id, name: admin.name, role: 'admin' } });
      } else {
        console.warn("Password mismatch");
        res.status(401).json({ success: false, message: "ÉCHEC : Mot de passe incorrect." });
      }
    } catch (e: any) {
      console.error("Unexpected login error:", e);
      res.status(500).json({ success: false, message: "Erreur interne : " + e.message });
    }
  });

  app.post("/api/auth/student/login", async (req, res) => {
    const { rfid_card, password } = req.body;
    try {
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('rfid_card', rfid_card)
        .single();

      if (student) {
        // Try bcrypt comparison first (for hashed passwords)
        let isMatch = false;
        try {
          isMatch = bcrypt.compareSync(password, student.password);
        } catch (e) {
          // Fallback to plain text check if bcrypt fails (e.g. if password isn't hashed)
          isMatch = (student.password === password);
        }

        if (isMatch) {
          res.json({ success: true, user: { id: student.id, name: student.name, rfid_card: student.rfid_card, role: 'student' } });
        } else {
          res.status(401).json({ success: false, message: "ÉCHEC : Mot de passe étudiant incorrect." });
        }
      } else {
        res.status(404).json({ success: false, message: "Veuillez vous présenter à l’administration pour obtenir une carte bibliothèque." });
      }
    } catch (e) {
      res.status(404).json({ success: false, message: "Veuillez vous présenter à l’administration pour obtenir une carte bibliothèque." });
    }
  });

  // Books
  app.get("/api/books", async (req, res) => {
    try {
      const { data: books, error } = await supabase
        .from('books')
        .select(`
          *,
          book_items (id, status)
        `);

      if (error) throw error;

      // Format data to match previous SQLite response
      const formattedBooks = books.map((b: any) => ({
        ...b,
        total_quantity: b.book_items?.length || 0,
        available_quantity: b.book_items?.filter((i: any) => i.status === 'available').length || 0
      }));

      res.json(formattedBooks);
    } catch (e) {
      res.status(500).json({ error: "Failed to load books" });
    }
  });

  app.get("/api/books/:id/items", async (req, res) => {
    try {
      const { data: items, error } = await supabase
        .from('book_items')
        .select('*')
        .eq('book_id', req.params.id);
      
      if (error) throw error;
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: "Failed to load items" });
    }
  });

  app.post("/api/books", async (req, res) => {
    const { title, author, barcode, image_url, quantity } = req.body;
    const qty = parseInt(quantity) || 1;
    
    try {
      // Step 1: Insert Book
      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert([{ title, author, barcode, image_url, quantity: qty }])
        .select()
        .single();

      if (bookError) throw bookError;

      // Step 2: Insert Items
      const items = [];
      for (let i = 1; i <= qty; i++) {
        items.push({
          book_id: book.id,
          unique_code: `${barcode}-${String(i).padStart(3, '0')}`,
          status: 'available'
        });
      }

      const { error: itemsError } = await supabase.from('book_items').insert(items);
      if (itemsError) throw itemsError;

      res.json({ success: true });
    } catch (e: any) {
      console.error("Supabase Error:", e);
      const message = e.code === '23505' // Unique constraint violation in Postgres
        ? "Ce code-barres est déjà utilisé par un autre livre." 
        : "Erreur lors de l'enregistrement : " + (e.message || "Erreur inconnue");
      res.status(400).json({ success: false, message });
    }
  });

  app.delete("/api/books/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('books').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete book" });
    }
  });

  // Borrowing
  app.post("/api/borrow", async (req, res) => {
    const { rfid_card, barcode, return_date } = req.body;
    
    try {
      // 1. Get Student
      const { data: student, error: studentErr } = await supabase.from('students').select('id').eq('rfid_card', rfid_card).single();
      if (!student || studentErr) return res.status(404).json({ message: "Étudiant non trouvé" });

      // 2. Get Item
      // Try unique code first
      let { data: item, error: itemErr } = await supabase.from('book_items').select('*').eq('unique_code', barcode).single();
      
      // If not found, try general barcode
      if (!item) {
        const { data: book } = await supabase.from('books').select('id').eq('barcode', barcode).single();
        if (book) {
          const { data: firstAvailable } = await supabase
            .from('book_items')
            .select('*')
            .eq('book_id', book.id)
            .eq('status', 'available')
            .limit(1)
            .single();
          item = firstAvailable;
        }
      }

      if (!item) return res.status(404).json({ message: "Livre ou exemplaire non trouvé" });
      if (item.status !== 'available') return res.status(400).json({ message: "Cet exemplaire est déjà emprunté" });

      // 3. Mark borrowed
      const { error: borrowErr } = await supabase.from('borrowings').insert([{
        student_id: student.id,
        book_item_id: item.id,
        return_date
      }]);
      if (borrowErr) throw borrowErr;

      const { error: updateErr } = await supabase.from('book_items').update({ status: 'borrowed' }).eq('id', item.id);
      if (updateErr) throw updateErr;

      res.json({ success: true, item_code: item.unique_code });
    } catch (e) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/return", async (req, res) => {
    const { barcode } = req.body;
    console.log(`Return request for barcode: ${barcode}`);
    
    try {
      // 1. Find the item
      let { data: item } = await supabase.from('book_items').select('*').eq('unique_code', barcode).maybeSingle();
      
      if (!item) {
        const { data: book } = await supabase.from('books').select('id').eq('barcode', barcode).maybeSingle();
        if (book) {
          const { data: firstBorrowed } = await supabase
            .from('book_items')
            .select('*')
            .eq('book_id', book.id)
            .eq('status', 'borrowed')
            .limit(1)
            .maybeSingle();
          item = firstBorrowed;
        }
      }

      if (!item) {
        return res.status(404).json({ message: "Livre non trouvé ou pas enregistré comme emprunté." });
      }

      // 2. Check if there is an active borrowing for this item
      const { data: activeBorrowing } = await supabase
        .from('borrowings')
        .select('id')
        .eq('book_item_id', item.id)
        .eq('returned', false)
        .maybeSingle();

      if (!activeBorrowing) {
        // If status was borrowed but no record found, we still fix the status
        console.warn(`Item ${item.id} status is borrowed but no active borrowing record found. Fixing status anyway.`);
        await supabase.from('book_items').update({ status: 'available' }).eq('id', item.id);
        return res.json({ success: true, warning: 'Livre mis en rayon, mais historique d\'emprunt introuvable.' });
      }

      // 3. Update borrowing record
      const { error: retErr } = await supabase
        .from('borrowings')
        .update({ returned: true, returned_at: new Date().toISOString() })
        .eq('id', activeBorrowing.id);
      
      if (retErr) throw retErr;

      // 4. Update item status
      const { error: pushErr } = await supabase.from('book_items').update({ status: 'available' }).eq('id', item.id);
      if (pushErr) throw pushErr;

      res.json({ success: true });
    } catch (e: any) {
      console.error("Return API fatal error:", e);
      res.status(500).json({ message: "Échec du retour : " + (e.message || "Erreur serveur") });
    }
  });

  app.get("/api/borrowings", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('borrowings')
        .select(`
          *,
          students (name),
          book_items (
            unique_code,
            books (title)
          )
        `)
        .order('borrow_date', { ascending: false });

      if (error) throw error;

      // Flatten the response
      const formatted = data.map((b: any) => ({
        ...b,
        student_name: b.students?.name,
        book_title: b.book_items?.books?.title,
        book_barcode: b.book_items?.unique_code
      }));

      res.json(formatted);
    } catch (err) {
      res.status(500).json({ success: false, message: "Erreur lors de la récupération des emprunts" });
    }
  });

  app.get("/api/student/:id/borrowings", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('borrowings')
        .select(`
          *,
          book_items (
            unique_code,
            books (title, author, image_url)
          )
        `)
        .eq('student_id', req.params.id)
        .eq('returned', false);

      if (error) throw error;

      const formatted = data.map((b: any) => ({
        ...b,
        book_title: b.book_items?.books?.title,
        book_author: b.book_items?.books?.author,
        book_image: b.book_items?.books?.image_url,
        item_code: b.book_items?.unique_code
      }));

      res.json(formatted);
    } catch (err) {
      res.status(500).json({ success: false, message: "Erreur lors de la récupération de vos emprunts" });
    }
  });

  // Students
  app.get("/api/students", async (req, res) => {
    try {
      const { data, error } = await supabase.from('students').select('id, name, rfid_card');
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Failed to load students" });
    }
  });

  app.post("/api/students", async (req, res) => {
    const { name, rfid_card, password } = req.body;
    
    try {
      if (!name || !rfid_card || !password) {
        return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires (Nom, RFID, Mot de passe)" });
      }

      console.log(`Creating student attempt: ${name} (${rfid_card})`);
      const hashedPassword = bcrypt.hashSync(password, 10);
      
      const { error } = await supabase
        .from('students')
        .insert([{ name, rfid_card, password: hashedPassword }]);

      if (error) {
        console.error("Supabase error detail:", JSON.stringify(error, null, 2));
        
        let userMessage = `Erreur Supabase : ${error.message}`;
        if (error.code === '23505') {
          userMessage = "Cette carte RFID est déjà enregistrée pour un autre étudiant.";
        }

        return res.status(400).json({ 
          success: false, 
          message: userMessage 
        });
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Unexpected error during student creation:", e);
      res.status(500).json({ 
        success: false, 
        message: `Erreur inattendue : ${e.message || 'Problème serveur'}` 
      });
    }
  });

  // Security Scan
  app.post("/api/security/scan", async (req, res) => {
    const { barcode } = req.body;
    
    try {
      // 1. Precise item search
      const { data: item } = await supabase
        .from('book_items')
        .select('*, books(id, title)')
        .eq('unique_code', barcode)
        .single();
      
      const realItem: any = item;

      if (realItem) {
        if (realItem.status === 'borrowed') {
          await supabase.from('security_logs').insert([{ book_id: realItem.books.id, status: 'authorized' }]);
          return res.json({ authorized: true, alarm: false });
        } else {
          await supabase.from('security_logs').insert([{ book_id: realItem.books.id, status: 'vol suspecté' }]);
          return res.json({ 
            authorized: false, 
            alarm: true, 
            message: `ALERTE VOL : L'exemplaire ${realItem.unique_code} de "${realItem.books.title}" n'est pas enregistré comme emprunté !` 
          });
        }
      }

      // 2. Generic barcode search
      const { data: book } = await supabase.from('books').select('*').eq('barcode', barcode).single();
      if (book) {
        // Checking if at least one item of this book is currently borrowed
        const { count, error } = await supabase
          .from('book_items')
          .select('*', { count: 'exact', head: true })
          .eq('book_id', book.id)
          .eq('status', 'borrowed');
        
        if (count !== null && count > 0) {
          await supabase.from('security_logs').insert([{ book_id: book.id, status: 'authorized' }]);
          return res.json({ authorized: true, alarm: false });
        } else {
          await supabase.from('security_logs').insert([{ book_id: book.id, status: 'vol suspecté' }]);
          return res.json({ 
            authorized: false, 
            alarm: true, 
            message: `ALERTE VOL : Aucun exemplaire de "${book.title}" n'est enregistré comme emprunté actuellement dans le système !` 
          });
        }
      }

      // 3. Unknown
      await supabase.from('security_logs').insert([{ status: 'Code inconnu détecté: ' + barcode }]);
      res.json({ authorized: false, alarm: true, message: "Code inconnu détecté !" });

    } catch (e) {
      res.status(500).json({ error: "Security scan failed" });
    }
  });

  app.get("/api/security/logs", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('security_logs')
        .select('*, books(title, barcode)')
        .order('detection_time', { ascending: false });
      
      if (error) throw error;
      const formatted = data.map((l: any) => ({
        ...l,
        book_title: l.books?.title,
        book_barcode: l.books?.barcode
      }));
      res.json(formatted);
    } catch (e) {
      res.status(500).json({ error: "Failed to load logs" });
    }
  });

  // Daily Report
  app.get("/api/admin/daily-report", async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const nextDay = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
      const { data: borrowings } = await supabase.from('borrowings').select('*, students(name), book_items(*, books(*))').gte('borrow_date', today).lt('borrow_date', nextDay);
      const { data: returns } = await supabase.from('borrowings').select('*, students(name), book_items(*, books(*))').eq('returned', true).gte('returned_at', today).lt('returned_at', nextDay);
      const { data: securityLogs } = await supabase.from('security_logs').select('*, books(title)').gte('detection_time', today).lt('detection_time', nextDay);
      const { data: proposals } = await supabase.from('book_proposals').select('*, students(name)').gte('created_at', today).lt('created_at', nextDay);

      res.json({
        date: today,
        borrowings: (borrowings || []).map((b: any) => ({ ...b, student_name: b.students?.name, book_title: b.book_items?.books?.title, item_code: b.book_items?.unique_code })),
        returns: (returns || []).map((r: any) => ({ ...r, student_name: r.students?.name, book_title: r.book_items?.books?.title, item_code: r.book_items?.unique_code })),
        securityLogs: (securityLogs || []).map((l: any) => ({ ...l, book_title: l.books?.title })),
        proposals: (proposals || []).map((p: any) => ({ ...p, student_name: p.students?.name }))
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Card Requests
  app.get("/api/card-requests", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('card_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Échec du chargement des demandes" });
    }
  });

  app.post("/api/card-requests", async (req, res) => {
    try {
      console.log("Receiving card request for:", req.body.email);
      const { error } = await supabase.from('card_requests').insert([{
        ...req.body,
        request_status: 'pending',
        created_at: new Date().toISOString()
      }]);
      
      if (error) {
        console.error("Supabase error during card request:", JSON.stringify(error, null, 2));
        throw error;
      }
      
      res.json({ success: true });
    } catch (e: any) {
      console.error("Critical card request error:", e.message || e);
      res.status(500).json({ success: false, message: e.message || "Erreur lors de l'enregistrement de la demande" });
    }
  });

  app.patch("/api/card-requests/:id/status", async (req, res) => {
    try {
      const { error } = await supabase
        .from('card_requests')
        .update({ request_status: req.body.status })
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Proposals
  app.get("/api/proposals", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('book_proposals')
        .select('*, students(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data.map((p: any) => ({ ...p, student_name: p.students?.name })));
    } catch (e) {
      res.status(500).json({ error: "Failed to load proposals" });
    }
  });

  app.get("/api/student/:id/proposals", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('book_proposals')
        .select('*')
        .eq('student_id', req.params.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Failed to load proposals" });
    }
  });

  app.post("/api/proposals", async (req, res) => {
    try {
      console.log("Proposal submission received:", req.body);
      const { error } = await supabase.from('book_proposals').insert([req.body]);
      if (error) {
        console.error("Supabase proposal error:", error.message, error.code);
        throw error;
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error("Proposal catch error:", e);
      res.status(500).json({ success: false, message: e.message || "Unknown error" });
    }
  });

  app.patch("/api/proposals/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('book_proposals').update({ status: req.body.status }).eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false });
    }
  });

  // Chat
  app.get("/api/chat/:studentId", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('student_id', req.params.studentId)
        .order('timestamp', { ascending: true });
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Failed to load messages" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { data, error } = await supabase.from('chat_messages').insert([req.body]).select().single();
      if (error) throw error;
      res.json({ success: true, message: data });
    } catch (e) {
      res.status(500).json({ success: false });
    }
  });

  app.get("/api/admin/chat-sessions", async (req, res) => {
    try {
      console.log("Fetching chat sessions...");
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          student_id, 
          students!inner(name), 
          content, 
          timestamp
        `)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Chat sessions error:", error);
        throw error;
      }

      const sessionsMap = new Map();
      data.forEach((m: any) => {
        if (!sessionsMap.has(m.student_id)) {
          sessionsMap.set(m.student_id, {
            id: m.student_id,
            name: m.students?.name || "Étudiant Inconnu",
            last_content: m.content,
            last_message: m.timestamp
          });
        }
      });

      console.log(`Found ${sessionsMap.size} chat sessions.`);
      res.json(Array.from(sessionsMap.values()));
    } catch (e: any) {
      console.error("Sessions route failed:", e);
      res.status(500).json({ error: "Failed to load chat sessions", details: e.message });
    }
  });

  // --- Vite Middleware ---
  // Error handling for API
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "API Route not found", url: req.originalUrl });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

// Only start the server if this file is run directly
if (process.env.NODE_ENV !== "production" || process.env.START_SERVER === "true") {
  createServer().then((app) => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
