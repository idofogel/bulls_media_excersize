require('dotenv').config();
const express = require('express');
// const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'logs', 'crash.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const app = express();
// const mysql = require('mysql2/promise');
const { Pool } = require('pg');

// const pool = mysql.createPool({
//   host: 'localhost',     // or your DB host
//   user: 'root',          // your MySQL username
//   password: 'yourpass',  // your MySQL password
//   database: 'mydb'       // your DB name (create manually or via code)
// });

// const pool = new Pool({
//   user: 'myuser',
//   host: 'localhost',
//   database: 'mydb',
//   password: 'mypassword',
//   port: 5432,
// });
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,  // will be 'postgres' because it's the service name
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
let originals = {};
(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS originals (
        id SERIAL PRIMARY KEY,
        keyword TEXT,
        src TEXT,
        creative TEXT,
        hash_method INTEGER,
        timestamp_field TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table created!');
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS originals_unique_idx
ON originals (keyword, src, creative)`);
console.log('index created!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
  }
})();
app.use(cors());
//check parameters to see that they are legal
function checkParam(str){
    try{
        //check for flags
        if(str.indexOf('~~~') === -1 || str.indexOf('~**~') === -1)
            return false;
        let chaeckstr = str.split('~**~');
        parstr = chaeckstr[1];
        let rawplaces = chaeckstr[0].split('~~~');
        let method = parseInt(rawplaces[0]);
        let places = rawplaces[1].split(',');
        let place1 = parseInt(places[0]);
        let place2 = parseInt(places[1]);
        //check the lengths of the strings make sense and that the method exists
        if(place1 < 0 || place2 < 0 || place1 > parstr.length || place2 > parstr.length|| (place1+place2) > parstr.length || method > 6 || method < 1)
            return false;
        return true;
    } catch(e){
        return false;
    }
}
//querying function
async function executeQuery(query,prms) {
    console.log(query);
        const client = await pool.connect();  // Get a client from the pool
        try {
            const result = await client.query(query,prms);  // Execute query
        return result.rows;  // Handle the result
      } catch (err) {
        console.error('Error executing query:', err);
      } finally {
        client.release();  // Release the client back to the pool
      }
    }
    //creating the new special parameters according to instructions
    function playprms(mthd,wordsarr) {
        console.log('in method '+mthd)
        let our_param1 = wordsarr[0]+wordsarr[1]+wordsarr[2];
        console.log('our_param1: '+our_param1);
        let our_params_prefix1 = mthd+"~~~"+(wordsarr[0].length)+","+(wordsarr[1].length)+"~**~";
        console.log('our_params_prefix1: '+our_params_prefix1);
        our_param = our_params_prefix1+our_param1;
        console.log('our_param: '+our_param);
        return our_param;
    }
    //add or update method and datetime for a newor existing set of parameters
    async function insertUpdateOrig(keyword, src, creative) {
        const res = await executeQuery(
            'select hash_method from originals where keyword= $1 and src= $2 and creative= $3 ORDER BY timestamp_field DESC LIMIT 1',[keyword, src, creative]
        );
        if (res.length > 0) {
            const prs = res[0];
            console.log('latest method:');
            console.log(prs);
            let hshmthd = parseInt(prs.hash_method) + 1;
            if (hshmthd >= 7) hshmthd = 1;

            await executeQuery(
                'update originals set hash_method= $1 where keyword= $2 and src= $3 and creative= $4',[hshmthd,keyword,src,creative]
            );

            console.log('internal hash methods: ' + hshmthd);
            return hshmthd;
        } else {
            await executeQuery(
                'insert into originals (keyword, src, creative, hash_method) values ($1, $2, $3, 1)',[keyword,src,creative]
            );

            console.log('internal hash methods: 1');
            return 1;
        }
    }
//root route, gets parameters and turns them into a special parameter and savesthem in the DB
app.get('/', async (req, res) => {
    try{
    let { keyword, src, creative } = req.query;
    // if a parameter is missing - turn it into an empty string
    if(keyword === undefined) keyword="";
    if(src === undefined) src="";
    if(creative === undefined) creative="";
    console.log(`Worker ${process.pid} is handling request`);
    //create special parameter for method 1
    let our_param = keyword+src+creative;
    let our_params_prefix = "1~~~"+(keyword.length)+","+(src.length)+"~**~";
    const mthd = await insertUpdateOrig(keyword,src,creative);
    console.log('hash method: '+mthd);
    our_param = our_params_prefix+our_param;
    //choose the special parameter formation accorrding to the method
    if(mthd === 2)
        our_param = playprms(mthd,[keyword,creative,src]);
    if(mthd === 3)
         our_param = playprms(mthd,[src,keyword,creative]);
    if(mthd === 4)
        our_param = playprms(mthd,[src,creative,keyword]);
    if(mthd === 5)
        our_param = playprms(mthd,[creative,keyword,src]);
    if(mthd === 6)
        our_param = playprms(mthd,[creative,src,keyword]);
    console.log('our_param'+our_param);
    const url = process.env.CONNECTED_NETWORK+encodeURIComponent(our_param);
    res.redirect(url);
} catch(err){
    console.log(err.message);
    try{logStream.write(`[${new Date().toISOString()}] Uncaught Exception:\n${err.message}\n`);} catch(e){}
    res.status(500).send('Server error');
}
});
//API that gets a special parameter and outputs the set.
app.get('/retrieve_original', (req, res) => {
    try{
        const { our_param } = req.query;
        console.log(`Worker ${process.pid} is handling request`);
        console.log('our_param');
        console.log(our_param);
        let dontsend = false;
        if(!checkParam(our_param)){
            res.send({error:'an illegal input'});
            dontsend = true;
        }
        const places_of_params = our_param.split("~**~");
        const hsmthd = places_of_params[0].split('~~~');
        const hash_method = parseInt(hsmthd[0]);
        let pars = hsmthd[1].split(',');
        let raw_strs = "";
        for(var follow = 1;follow<places_of_params.length;follow++){
            raw_strs+= places_of_params[follow];
        }
        let endIndex = parseInt(pars[0]);
        let endIndex2 = parseInt(pars[1]);
        let second_offset = (endIndex+endIndex2);
        //get first word
        let word1 = raw_strs.substring(0, endIndex);
        let word2 = raw_strs.substring(endIndex, second_offset);
        let word3 = raw_strs.substring(second_offset, raw_strs.length);
        console.log('word1: '+word1+' word2: '+word2+' word3 '+word3);
        let retval = {'keyword': word1,
            'src': word2,
            'creative': word3}
            console.log('hash_method: '+hash_method);
        if(hash_method === 1)
            retval = {'keyword': word1,'src': word2,'creative': word3}
        if(hash_method === 2) retval = {'keyword': word1,'src': word3,'creative': word2}
        if(hash_method === 3)
            retval = {'keyword': word2,'src': word1,'creative': word3}
        if(hash_method === 4)
            retval = {'keyword': word3,'src': word1,'creative': word2}
        if(hash_method === 5)
            retval = {'keyword': word2,'src': word3,'creative': word1}
        if(hash_method === 6)
            retval = {'keyword': word3,'src': word2,'creative': word1}
        if(!dontsend){
            console.log('retval');
            console.log(retval);
            res.send(retval);
        }
    } catch(err){
        try{logStream.write(`[${new Date().toISOString()}] Uncaught Exception:\n${err.message}\n`);} catch(e){}
        res.status(500).send('Server error');
    }
});
//this is a redirection route I created for testing
app.get('/redirection_page',(req,res) => {
    const { our_param } = req.query;
    res.send('redirection: '+our_param);
});
//a route that gets the parameters and returns the last time a parameters set was generated for them.
app.get('/find_update_date',async(req,res) => {
    try{
        let { keyword, src, creative } = req.query;
        if(keyword===undefined) keyword="";
        if(src===undefined) src="";
        if(creative===undefined) creative="";
        const resu = await executeQuery('select * from originals where keyword= $1 and src= $2 and creative= $3 ORDER BY timestamp_field DESC LIMIT 1',[keyword, src, creative]);
        if(resu.length > 0){
            const res_to_ret = `parameters set:{keyword:${keyword} src:${src} creative:${creative}} was last reset on ${resu[0].timestamp_field}`;
            res.send(res_to_ret);
        } else {
            const res_to_ret = `no records found for parameters set:{keyword:${keyword} src:${src} creative:${creative}}`;
            res.send(res_to_ret);
        }
    } catch(e){
        res.send('illegal parameters');
    }
});
app.listen(3000, '0.0.0.0', () => {
  console.log('Server listening on port 3000');
});