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
    let sql = 'SELECT * FROM Data WHERE area == ?';
    db.all(sql, [req.params.country_id], (err, rows) => { //the question mark in sql gets replaced with G, sql recognizes it as a placeholder
        if (err){
            res.status(500).type('txt').send('SQL Error');
        }
        else{
            //res.status(200).type('json').send(JSON.stringify(rows));
            fs.readFile(path.join(template, 'country.html'), {encoding: 'utf8'}, (err, data) => {
                //look at how indented we are
                let country_data = '';
                for (let i=0; i < rows.length; i++){
                    country_data += '<tr><td>' + rows[i].name + '</td>';
                    country_data += '<td>' + rows[i].calories + '</td></tr>';
                }
                let response = data.replace('$$$COUNTRY_ROWS$$$', country_data);
                res.status(200).type('html').send(response);
            })
        }
    })
}); 

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
