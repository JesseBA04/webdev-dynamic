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
    let sql = 'SELECT * FROM Data'; 
    db.all(sql, [], (err, rows) => { //the question mark in sql gets replaced with G, sql recognizes it as a placeholder
        if (err){
            res.status(500).type('txt').send('SQL Error');
        }
        else{
            //res.status(200).type('json').send(JSON.stringify(rows));
            fs.readFile(path.join(template, 'index.html'), {encoding: 'utf8'}, (err, data) => {
                //look at how indented we are
                let country_list = '';
                for (let i=0; i < rows.length; i++){
                    country_list += '<li><a href="/country/' + rows[i].id + '">';
                    country_list += rows[i].name + '</a></li>';
                }
                let response = data.replace('$$$COUNTRY_LIST$$$', country_list);
                res.status(200).type('html').send(response);
            })
        }
    })
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
