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


app.get('/countryHome', (req, res) => {
    let sql = 'SELECT * FROM Data'; 
    let country_already_displayed = [];
    db.all(sql, [], (err, rows) => { //the question mark in sql gets replaced with G, sql recognizes it as a placeholder
        if (err){
            res.status(500).type('txt').send('SQL Error');
        }
        else{
            //res.status(200).type('json').send(JSON.stringify(rows));
            fs.readFile(path.join(template, 'countryHome.html'), {encoding: 'utf8'}, (err, data) => {
                //look at how indented we are
                let country_list = '';
                for (let i=0; i < rows.length; i++){
                    if(country_already_displayed.includes(rows[i].area)){

                    }else{
                        country_already_displayed.push(rows[i].area)
                        country_list += '<li><a href="/country/' + rows[i].id + '">'; //this will bring us to the url, /country/China (China is an example)
                        country_list += rows[i].area + '</a></li>';
                    }
                }
                let response = data.replace('$$$COUNTRY_LIST$$$', country_list);
                res.status(200).type('html').send(response);
            })
        }
    })
});

// This will be used to display each countries data, ex. /country/China
app.get('/country/:country_id', (req, res) => {
    const name = req.params.country_id;
    
    // First check if this country exists in the database
    const checkSql = 'SELECT COUNT(*) as count FROM Data WHERE area = ?';
    db.get(checkSql, [name], (checkErr, checkResult) => {
        if (checkErr) return res.status(500).type('txt').send('SQL Error');
        if (checkResult.count === 0) {
            return res.status(404).type('txt').send(`Error: no data for country "${name}"`);
        }
        
        // Country exists, proceed with the original logic
        let sql = 'SELECT * FROM Data WHERE area == ?';
        const listSql = 'SELECT DISTINCT area as v FROM Data WHERE area IS NOT NULL ORDER BY area';

        // First, get the full variable list to compute prev/next
        db.all(listSql, [], (listErr, vrows) => {
            if (listErr) return res.status(500).type('txt').send('SQL Error');
            const list = (vrows || []).map(r => r.v);
            const len = list.length || 1;
            let idx = Math.max(0, list.indexOf(name));
            if (idx === -1) idx = 0; // fallback if not found
            const prev = list[(idx - 1 + len) % len] || name;
            const next = list[(idx + 1) % len] || name;

        db.all(sql, [req.params.country_id], (err, rows) => { //the question mark in sql gets replaced with G, sql recognizes it as a placeholder
            if (err){
                res.status(500).type('txt').send('SQL Error');
            }
            else{
                const check = req.params.country_id;
                if (!['China','France','Russian Federation', 'United Kingdom of Great Britain and Northern Ireland', 'United States of America'].includes(check)) { res.status(404).type('txt').send('Error: ' + check + 'is not a valid country'); return; }
                //res.status(200).type('json').send(JSON.stringify(rows));
                fs.readFile(path.join(template, 'country.html'), {encoding: 'utf8'}, (err, data) => {
                    //look at how indented we are
                    let country_data = '';
                    let graph_array_data = [];
                    let graph_array_year = [];
                    let count = 0;
                    for (let i=0; i < rows.length; i++){
                        country_data += '<tr><td>' + rows[i].variable + '</td>';
                        if(rows[i].variable == 'SDG 6.4.1. Water Use Efficiency'){
                            graph_array_data[count] = [rows[i].value];
                            graph_array_year[count] = [rows[i].year];
                            count++;
                        }
                        country_data += '<td>' + rows[i].value + '</td>';
                        country_data += '<td>' + rows[i].unit + '</td>';
                        country_data += '<td>' + rows[i].year + '</td></tr>';
                    }
                    //this will be used for the buttons on the top of the page
                    const nav = `
                    <div class="var-nav">
                        <a class="pill" href="/country/${encodeURIComponent(prev)}">&#9664; Prev</a>
                        <span class="pill variable-badge">${name}</span>
                        <a class="pill" href="/country/${encodeURIComponent(next)}">Next &#9654;</a>
                    </div>`;

                    const graph = `
                    <div id="tester" style="width:600px;height:250px;"></div>
                        <script>
	                        TESTER = document.getElementById('tester');
	                        Plotly.newPlot( TESTER, [{
	                        x: [${graph_array_year}],
	                        y: [${graph_array_data}] }], {
	                        margin: { t: 0 } } );
                        </script>`

                    let response = data.replace('$$$COUNTRY_ROWS$$$', country_data)
                        .replace(/\$\$\$COUNTRY_NAME\$\$\$/g, name)
                        .replace('$$$COUNTRY_NAV$$$', nav)
                        .replace('$$$GRAPH$$$', graph);
                    
                    res.status(200).type('html').send(response);
                })
            }
        })
        });
    });
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
            let response = data
                .replace('$$$TITLE$$$', 'Display')
                .replace('$$$TITLE2$$$', 'Display')
                .replace('$$$LIST$$$', list)
                .replace('$$$IMAGE_PATH$$$', '/images/variable.png')
                .replace('$$$IMGTITLE$$$', 'Display')
                .replace('$$$EXTRA$$$', '');
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
        if (rows.length === 0) {
            res.status(404).type('txt').send(`Error: no ${type} found in database`);
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
                const extra = '';
                
                // Map type to actual image files
                const imageMap = { 
                    countries: '/images/country.jpg', 
                    variables: '/images/variable.png', 
                    years: '/images/year.png' 
                };
                const imagePath = imageMap[type] || '/images/variable.png';

                            let response = data
                                    .replace('$$$TITLE2$$$', title)
                                    .replace('$$$LIST$$$', list)
                                    .replace('$$$IMAGE_PATH$$$', imagePath)
                                    .replace('$$$IMGTITLE$$$', title)
                                    .replace('$$$EXTRA$$$', extra)
                                    .replace('$$$TITLE$$$', title);
            res.status(200).type('html').send(response);
        });
    });
});

// Route: /variable/:name - show rows for a given variable (renders variable.html)
app.get('/variable/:name', (req, res) => {
    const name = req.params.name;
    
    // First check if this variable exists in the database
    const checkSql = 'SELECT COUNT(*) as count FROM Data WHERE variable = ?';
    db.get(checkSql, [name], (checkErr, checkResult) => {
        if (checkErr) return res.status(500).type('txt').send('SQL Error');
        if (checkResult.count === 0) {
            return res.status(404).type('txt').send(`Error: no data for variable "${name}"`);
        }
        
        // Variable exists, proceed with the original logic
        const rowsSql = 'SELECT area, year, value, unit FROM Data WHERE variable = ? ORDER BY area, year';
        const listSql = 'SELECT DISTINCT variable as v FROM Data WHERE variable IS NOT NULL ORDER BY variable';

        // First, get the full variable list to compute prev/next
        db.all(listSql, [], (listErr, vrows) => {
            if (listErr) return res.status(500).type('txt').send('SQL Error');
            const list = (vrows || []).map(r => r.v);
            const len = list.length || 1;
            let idx = Math.max(0, list.indexOf(name));
            if (idx === -1) idx = 0; // fallback if not found
            const prev = list[(idx - 1 + len) % len] || name;
            const next = list[(idx + 1) % len] || name;

            // Then, get the data rows for the current variable
            db.all(rowsSql, [name], (err, rows) => {
                if (err) return res.status(500).type('txt').send('SQL Error');
                fs.readFile(path.join(template, 'variable.html'), { encoding: 'utf8' }, (tplErr, data) => {
                if (tplErr) return res.status(500).type('txt').send('Template read error');

                const dataRows = rows.map(r => `                <tr><td>${r.area}</td><td>${r.year}</td><td>${r.value}</td><td>${r.unit}</td></tr>`).join('\n');
                const nav = `
                <div class="var-nav">
                    <a class="pill" href="/variable/${encodeURIComponent(prev)}">&#9664; Prev</a>
                    <span class="pill variable-badge">${name}</span>
                    <a class="pill" href="/variable/${encodeURIComponent(next)}">Next &#9654;</a>
                </div>`;

                const out = data
                    .replace(/\$\$\$VARIABLE\$\$\$/g, name)
                    .replace('$$$VARIABLE_NAV$$$', nav)
                    .replace('$$$DATA_ROWS$$$', dataRows || '<tr><td colspan="3">No data</td></tr>');
                res.status(200).type('html').send(out);
            });
        });
        });
    });
});



//years 2020/2021/2022 + country across those years

app.get('/yearsHome', (req, res) => {
    fs.readFile(path.join(template, 'yearsHome.html'), {encoding: 'utf8'}, (err, data) => {
        if (err) { res.status(500).type('txt').send('Template read error'); return; }
        const list = [2020,2021,2022].map(y => `<li><a href="/year/${y}">${y}</a></li>`).join('\n');
        res.status(200).type('html').send(data.replace('$$$YEAR_LIST$$$', list));
    });
});

app.get('/year/:year', (req, res) => {
    const y = parseInt(req.params.year, 10);
    if (![2020,2021,2022].includes(y)) { res.status(404).type('txt').send('Error: year must be 2020, 2021, or 2022'); return; }
    const sql = 'SELECT area, variable, value, unit FROM Data WHERE year = ? ORDER BY area, variable';
    db.all(sql, [y], (err, rows) => {
        if (err){ res.status(500).type('txt').send('SQL Error'); return; }
        if (rows.length === 0){ res.status(404).type('txt').send(`Error: no data for year ${y}`); return; }
        fs.readFile(path.join(template, 'year.html'), {encoding: 'utf8'}, (tErr, tpl) => {
            if (tErr){ res.status(500).type('txt').send('Template read error'); return; }
            const prev = y === 2020 ? 2022 : y - 1;
            const next = y === 2022 ? 2020 : y + 1;
            const table = rows.map(r => `<tr><td>${r.area}</td><td>${r.variable}</td><td>${r.value}</td><td>${r.unit}</td></tr>`).join('\n');
            const rowsJson = JSON.stringify(rows);  // <-- added
            let out = tpl
                .replace(/\$\$\$YEAR\$\$\$/g, String(y))
                .replace('$$$YEAR_ROWS$$$', table || '<tr><td colspan="4">No data</td></tr>')
                .replace('$$$PREV_LINK$$$', `/year/${prev}`)
                .replace('$$$NEXT_LINK$$$', `/year/${next}`)
                .replace('$$$ROWS_JSON$$$', rowsJson); // <-- added
            res.status(200).type('html').send(out);
        });
    });
});


app.get('/countryYears/:country', (req, res) => {
    const c = req.params.country;
    
    // First check if this country exists in the database
    const checkSql = 'SELECT COUNT(*) as count FROM Data WHERE area = ?';
    db.get(checkSql, [c], (checkErr, checkResult) => {
        if (checkErr) return res.status(500).type('txt').send('SQL Error');
        if (checkResult.count === 0) {
            return res.status(404).type('txt').send(`Error: no data for country "${c}"`);
        }
        
        // Country exists, proceed with the original logic
        const rowsSql = `SELECT year, variable, value FROM Data 
                         WHERE area = ? AND year IN (2020,2021,2022)
                         ORDER BY year, variable`;
        const aggSql = `SELECT year, SUM(value) AS total FROM Data 
                        WHERE area = ? AND year IN (2020,2021,2022)
                        GROUP BY year ORDER BY year`;
        db.all(rowsSql, [c], (err, rows) => {
            if (err){ res.status(500).type('txt').send('SQL Error'); return; }
            if (rows.length === 0){ res.status(404).type('txt').send(`Error: no data for country "${c}" in years 2020-2022`); return; }
            db.all(aggSql, [c], (e2, agg) => {
            if (e2){ res.status(500).type('txt').send('SQL Error'); return; }
            fs.readFile(path.join(template, 'countryYears.html'), {encoding: 'utf8'}, (tErr, tpl) => {
                if (tErr){ res.status(500).type('txt').send('Template read error'); return; }
                const table = rows.map(r => `<tr><td>${r.year}</td><td>${r.variable}</td><td>${r.value}</td></tr>`).join('\n');
                const series = JSON.stringify(agg || []); // [{year,total},...]
                let out = tpl
                    .replace(/\$\$\$COUNTRY\$\$\$/g, c)
                    .replace('$$$COUNTRY_YEAR_ROWS$$$', table || '<tr><td colspan="3">No data</td></tr>')
                    .replace('$$$SERIES_JSON$$$', series);
                res.status(200).type('html').send(out);
            });
        });
    });
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
