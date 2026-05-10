const xlsx = require('xlsx');
const fs = require('fs');

try {
    const workbook = xlsx.readFile('ficheir excel -ouvages bibliotheque.xlsx');
    const sheet_name_list = workbook.SheetNames;
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

    let sql = `-- Fichier d'importation généré automatiquement\n`;
    sql += `TRUNCATE TABLE borrowings, security_logs, book_items, books RESTART IDENTITY CASCADE;\n\n`;

    // Extract unique books and all items
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

        // Map books to avoid duplicate inserts
        if (!booksMap.has(cote)) {
            booksMap.set(cote, { title: titre, author: auteur, quantity: 1 });
        } else {
            booksMap.get(cote).quantity++;
        }

        items.push({ cote, ndinv });
    });

    // 1. Insert Books
    sql += `-- 1. Insertion des livres uniques\n`;
    sql += `INSERT INTO books (barcode, title, author, quantity) VALUES\n`;
    
    const booksValues = [];
    booksMap.forEach((val, key) => {
        booksValues.push(`('${key}', '${val.title}', '${val.author}', ${val.quantity})`);
    });
    sql += booksValues.join(',\n') + ';\n\n';

    // 2. Insert Items using Subqueries
    sql += `-- 2. Insertion des exemplaires individuels\n`;
    sql += `INSERT INTO book_items (book_id, unique_code, status) VALUES\n`;
    
    const itemsValues = items.map(item => 
        `((SELECT id FROM books WHERE barcode = '${item.cote}'), '${item.ndinv}', 'available')`
    );
    sql += itemsValues.join(',\n') + ';\n';

    fs.writeFileSync('import_books.sql', sql, 'utf8');
    console.log(`Génération réussie ! ${items.length} exemplaires et ${booksMap.size} livres uniques traités.`);

} catch (err) {
    console.error("Erreur:", err);
}
