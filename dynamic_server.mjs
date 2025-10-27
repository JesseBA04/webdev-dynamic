import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const port = 8080;
const root = path.join(__dirname, 'public');
const template = path.join(__dirname, 'templates');

let app = express();
app.use(express.static(root));

const db = new sqlite3.Database('./AquaStat.sqlite3', sqlite3.OPEN_READONLY, (err) => {  //will be using READWRITE in the future
    if(err){
        console.log('Error connecting to database');
    }
    else{
        console.log('Succesfully connected to database');
    }
});

app.get('/', (req, res) => {
    fs.readFile(path.join(template, 'index.html'), {encoding: 'utf8'}, (err, data) => {
        if (err) {
            res.status(500).type('txt').send('Template read error');
            return;
        }
        let filter_list = '';
        filter_list += '<li><a href="/display.html?type=countries">Area</a></li>\n';
        filter_list += '<li><a href="/display.html?type=variables">Variable</a></li>\n';
        filter_list += '<li><a href="/display.html?type=years">Year</a></li>';

        let response = data.replace('$$$FILTER_LIST$$$', filter_list);
        res.status(200).type('html').send(response);
    });
});

app.get('/display.html', (req, res) => {
    const type = (req.query.type || '').toLowerCase();
    const tplPath = path.join(template, 'display.html');

    // No type specified - show links to all three types
    if (!type || !['countries', 'variables', 'years'].includes(type)) {
        fs.readFile(tplPath, {encoding: 'utf8'}, (err, data) => {
            if (err) {
                res.status(500).type('txt').send('Template read error');
                return;
            }
            let list = ['countries', 'variables', 'years']
                .map(t => `<li><a href="/display.html?type=${t}">${t}</a></li>`)
                .join('\n');
            let response = data.replace('$$$TITLE$$$', 'Display').replace('$$$LIST$$$', list);
            res.status(200).type('html').send(response);
        });
        return;
    }

    // Map type to column name
    const colMap = { countries: 'area', variables: 'variable', years: 'year' };
    const sql = `SELECT DISTINCT "${colMap[type]}" as value FROM Data WHERE "${colMap[type]}" IS NOT NULL ORDER BY "${colMap[type]}"`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).type('txt').send('SQL Error');
            return;
        }
        fs.readFile(tplPath, {encoding: 'utf8'}, (err, data) => {
            if (err) {
                res.status(500).type('txt').send('Template read error');
                return;
            }
                // Create links for each value using singular bases: /country, /variable, /year
                const baseMap = { countries: 'country', variables: 'variable', years: 'year' };
                const base = baseMap[type] || type;
                let list = rows.map(row => 
                    `<li><a href="/${base}/${encodeURIComponent(row.value)}">${row.value}</a></li>`
                ).join('\n');
                if (!list) list = '<li>(no values)</li>';
            
                // Capitalize first letter of type and make rest lowercase
                const title = type.charAt(0).toUpperCase() + type.slice(1);
                let response = data.replace('$$$TITLE2$$$', title).replace('$$$LIST$$$', list).replace('$$$TITLE$$$', title);
            res.status(200).type('html').send(response);
        });
    });
});

// Route: /variable/:name -> show rows for a given variable (renders variable.html)
app.get('/variable/:name', (req, res) => {
    const name = req.params.name;
    const sql = 'SELECT area, year, value FROM Data WHERE variable = ? ORDER BY area, year';
    db.all(sql, [name], (err, rows) => {
        if (err) return res.status(500).type('txt').send('SQL Error');
        fs.readFile(path.join(template, 'variable.html'), { encoding: 'utf8' }, (err, data) => {
            if (err) return res.status(500).type('txt').send('Template read error');
            const dataRows = rows.map(r => `                <tr><td>${r.area}</td><td>${r.year}</td><td>${r.value}</td></tr>`).join('\n');
            const out = data.replace(/\$\$\$VARIABLE\$\$\$/g, name).replace('$$$DATA_ROWS$$$', dataRows || '<tr><td colspan="3">No data</td></tr>');
            res.status(200).type('html').send(out);
        });
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
