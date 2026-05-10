const xlsx = require('xlsx');
const fs = require('fs');

try {
    const workbook = xlsx.readFile('ficheir excel -ouvages bibliotheque.xlsx');
    const sheet_name_list = workbook.SheetNames;
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

    const booksMap = new Map();
    const items = [];
    const seenNdinv = new Set();

    data.forEach((row, index) => {
        let cote = row['COTE'] ? String(row['COTE']).trim().replace(/'/g, "''") : null;
        let titre = row['TITRE'] ? String(row['TITRE']).trim().replace(/'/g, "''") : 'Titre Inconnu';
        let auteur = row['AUTEUR'] ? String(row['AUTEUR']).trim().replace(/'/g, "''") : 'Auteur Inconnu';
        let ndinv = row["N.D'INV"] ? String(row["N.D'INV"]).trim().replace(/'/g, "''") : null;

        if (!ndinv) ndinv = cote ? `${cote}-AUTO-${index}` : `AUTO-${index}`;
        if (!cote) cote = `NO-COTE-${index}`;

        if (seenNdinv.has(ndinv)) ndinv = `${ndinv}-DUB-${index}`;
        seenNdinv.add(ndinv);

        if (!booksMap.has(cote)) {
            booksMap.set(cote, { title: titre, author: auteur, quantity: 1 });
        } else {
            booksMap.get(cote).quantity++;
        }

        items.push({ cote, ndinv });
    });

    const CHUNK_SIZE = 2000;
    
    const booksValues = [];
    booksMap.forEach((val, key) => {
        booksValues.push(`('${key}', '${val.title}', '${val.author}', ${val.quantity})`);
    });

    const itemsValues = items.map(item => 
        `((SELECT id FROM books WHERE barcode = '${item.cote}'), '${item.ndinv}', 'available')`
    );

    let fileCount = 1;
    let sql = `-- Fichier d'importation Partie ${fileCount}\n`;
    sql += `TRUNCATE TABLE borrowings, security_logs, book_items, books RESTART IDENTITY CASCADE;\n\n`;

    // 1. Process books in chunks
    for (let i = 0; i < booksValues.length; i += CHUNK_SIZE) {
        if (i > 0) {
            fs.writeFileSync(`import_books_part${fileCount}.sql`, sql, 'utf8');
            fileCount++;
            sql = `-- Fichier d'importation Partie ${fileCount}\n\n`;
        }
        
        const booksChunk = booksValues.slice(i, i + CHUNK_SIZE);
        sql += `-- Insertion des livres uniques (Partie ${fileCount})\n`;
        sql += `INSERT INTO books (barcode, title, author, quantity) VALUES\n`;
        sql += booksChunk.join(',\n') + ';\n\n';
    }
    
    // 2. Process items in chunks
    for (let i = 0; i < itemsValues.length; i += CHUNK_SIZE) {
        fs.writeFileSync(`import_books_part${fileCount}.sql`, sql, 'utf8');
        fileCount++;
        sql = `-- Fichier d'importation Partie ${fileCount}\n\n`;
        
        const itemsChunk = itemsValues.slice(i, i + CHUNK_SIZE);
        sql += `-- Insertion des exemplaires (Partie ${fileCount})\n`;
        sql += `INSERT INTO book_items (book_id, unique_code, status) VALUES\n`;
        sql += itemsChunk.join(',\n') + ';\n\n';
    }
    
    // Write the last file
    fs.writeFileSync(`import_books_part${fileCount}.sql`, sql, 'utf8');
    
    console.log(`Génération réussie ! Les requêtes ont été séparées en ${fileCount} fichiers.`);

} catch (err) {
    console.error("Erreur:", err);
}
