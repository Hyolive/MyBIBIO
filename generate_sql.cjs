const xlsx = require('xlsx');
const fs = require('fs');

try {
    const workbook = xlsx.readFile('ficheir excel -ouvages bibliotheque.xlsx');
    const sheet_name_list = workbook.SheetNames;
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

    let sql = `-- Fichier d'importation généré automatiquement\n`;
    sql += `TRUNCATE TABLE borrowings, security_logs, book_items, books RESTART IDENTITY CASCADE;\n\n`;
    sql += `CREATE TABLE temp_import (\n    cote TEXT,\n    titre TEXT,\n    auteur TEXT,\n    ndinv TEXT\n);\n\n`;
    sql += `INSERT INTO temp_import (cote, titre, auteur, ndinv) VALUES\n`;

    const values = [];
    let count = 0;
    
    // Pour éviter les doublons de N.D'INV qui pourraient faire planter l'insertion UNIQUE
    const seenNdinv = new Set();

    data.forEach((row, index) => {
        let cote = row['COTE'] ? String(row['COTE']).trim().replace(/'/g, "''") : null;
        let titre = row['TITRE'] ? String(row['TITRE']).trim().replace(/'/g, "''") : 'Titre Inconnu';
        let auteur = row['AUTEUR'] ? String(row['AUTEUR']).trim().replace(/'/g, "''") : 'Auteur Inconnu';
        let ndinv = row["N.D'INV"] ? String(row["N.D'INV"]).trim().replace(/'/g, "''") : null;

        // Si ndinv est manquant, on génère un code unique pour l'exemplaire
        if (!ndinv) {
            ndinv = cote ? `${cote}-AUTO-${index}` : `AUTO-${index}`;
        }
        
        // On s'assure que cote n'est pas vide (utilisé comme code barre du livre)
        if (!cote) {
            cote = `NO-COTE-${index}`;
        }

        // Si le N.D'INV est déjà vu (erreur dans excel), on le rend unique
        if (seenNdinv.has(ndinv)) {
            ndinv = `${ndinv}-DUB-${index}`;
        }
        seenNdinv.add(ndinv);

        values.push(`('${cote}', '${titre}', '${auteur}', '${ndinv}')`);
        count++;
    });

    sql += values.join(',\n') + ';\n\n';

    sql += `-- Insertion des livres uniques en groupant par COTE\n`;
    sql += `INSERT INTO books (barcode, title, author, quantity)\n`;
    sql += `SELECT cote, MIN(titre), MIN(auteur), COUNT(*)\n`;
    sql += `FROM temp_import\n`;
    sql += `GROUP BY cote;\n\n`;

    sql += `-- Insertion des exemplaires (book_items) en reliant à l'ID du livre créé\n`;
    sql += `INSERT INTO book_items (book_id, unique_code, status)\n`;
    sql += `SELECT b.id, t.ndinv, 'available'\n`;
    sql += `FROM temp_import t\n`;
    sql += `JOIN books b ON b.barcode = t.cote;\n\n`;
    
    sql += `DROP TABLE temp_import;\n`;

    fs.writeFileSync('import_books.sql', sql, 'utf8');
    console.log(`Génération réussie ! ${count} exemplaires traités. Fichier import_books.sql créé.`);

} catch (err) {
    console.error("Erreur:", err);
}
