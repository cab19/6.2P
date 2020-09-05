const express = require('express');
const bodyParser = require('body-parser');
const validator = require("validator");
const mongoose = require("mongoose");
const AutoIncrement = require('mongoose-sequence')(mongoose);
mongoose.connect("mongodb://localhost:27017/iCrowdTask", {useNewUrlParser:true});
const RequesterSchema = require("./models/Requester");
const APIKeys = require("./key"); // import api key from module ignored by Git
const bcrypt = require('bcrypt-nodejs');
const passwordutil = require('./password'); // module for hashing
const https = require('https');
const app = express();

app.use(bodyParser.urlencoded({extended:true}))
app.use(express.static(__dirname + '/public'));

RequesterSchema.plugin(AutoIncrement, {inc_field: 'id'}); // autoincrement id
const Requester = mongoose.model("Requester", RequesterSchema);


// REST API

app.route('/requesters')
.get( (req, res)=>{
    console.log("really?");
    Requester.find((err, requesterList)=>{
        if (err)
            res.send(err);
        else 
            res.send(requesterList);
    });
})
.post((req,res)=>{
    passwordutil.hash(req.body.password, function(hashedPass){
        if(hashedPass){
            const requester = new Requester({
                country : req.body.country,
                fName : req.body.fName,
                lName : req.body.lName,
                email : req.body.email,
                password : hashedPass,
                address : req.body.address,
                city : req.body.city,
                state : req.body.state,
            });
            requester.save((err) =>{
                if (err)
                    res.send(err);
                else 
                    res.send ('Successfully added a new requester!');
            });
        }
        else
            res.send(err);
    });
})
.delete((req,res) =>{
    Requester.deleteMany((err) =>{
        if (err)
            res.send(err);
        else{
            Requester.counterReset('id', function(err) {
                // Now the counter is 0
            });
            res.send('Successfully deleted all requesters!');
        }
    });
})

app.route('/requesters/:test')
.get((req, res)=>{
    console.log("AHHHH  "+req.params.test);
    // Requester.findOne({id: req.params.id}, (err, foundRequester)=>{
    // Requester.findById({id: req.params.test}, (err, foundRequester) => {
        
    //     if (!foundRequester)
    //         res.send('No result found');
    //     else
    //         res.send(foundRequester);
    // });
})
.patch((req, res)=>{
    Requester.update(
        {id: req.params.id},
        {$set: req.body},
        (err)=>{
            if (err)
                res.send(err);
            else
                res.send('Successfully updated!');
        });
})



app.get('/', (req,res)=>{
    res.redirect('/reqregister');
});

app.get('/reqlogin', (req,res)=>{
    res.sendFile(__dirname + "/public/reqlogin.html");
});

app.get('/reqregister', (req,res)=>{
    res.sendFile(__dirname + "/public/reqregister.html");
});

app.post('/reqregister', (req,res)=>{
    let error = false;

    // ensure passwords match
    let password = req.body.password;
    if(password != req.body.passwordRepeat){
        password = "";
        error = true;
        console.log('Passwords dont match!');
    }
    
    // ensure country is not default option
    let country = req.body.country;
    if(country === "Country of residence *"){
        country = "";
        error = true;
        console.log('Country of residence not entered!');
    }

    if(!error){ // if above is okay process form        
        passwordutil.hash(password, function(hashedPass){
            if(hashedPass){
                const requester = new Requester(
                    {
                        country : country,
                        fName : req.body.fName,
                        lName : req.body.lName,
                        email : req.body.email,
                        password : hashedPass,
                        address : req.body.address,
                        city : req.body.city,
                        state : req.body.state,
                    }
                );
            
                requester.save((err) =>{ 
                    if (err){
                        console.log(err);
                        res.sendFile(__dirname + "/public/error.html");   
                    }
                    else{
                        console.log("Success!");
                        mailchimpSubscribe(req.body.fName, req.body.lName, req.body.email);
                        res.redirect('/reqlogin');
                    }
                });
            }
            else
                console.log("Error hashing password");
        });
    }
    else // issues with form contents
        res.sendFile(__dirname + "/public/error.html");
});

app.post('/login', (req,res)=>{
    // handle verification of credentials
    let email = req.body.email;
    let password = req.body.password;

    Requester.findOne({ 'email': email }, 'password', function (err, requester) {
        if (err) return handleError(err);
        if(requester){ // result found for email
            bcrypt.compare(password, requester.password, (err, compResult) => {
                if(compResult) // passwords match
                    res.sendFile(__dirname + "/public/reqtask.html");
                else{ //passwords don't match
                    console.log("Passwords don't match.");
                    res.redirect('/reqlogin');
                }
            });
        }
        else{ // no user in db has provided email.
            console.log("No matching email in database.");
            res.redirect('/reqlogin');
        }
    });
});

function mailchimpSubscribe(fName, lName, email){
    const data = {
        members:[{
            email_address: email,
            status : "subscribed",
            merge_fields:{
                FNAME: fName,
                LNAME:lName,
            },
        }]
    };
    jsonData = JSON.stringify(data);
    
    const listId = "88efab0acc";
    const url = "https://us17.api.mailchimp.com/3.0/lists/"+listId;
    const options={
        method: "POST",
        auth:"cb:"+APIKeys.mailChimpAPIKey,
    };

    const request = https.request(url, options , (response)=>{
        response.on("data", (data)=> {/*console.log(JSON.parse(data)) */});
    })

    request.write(jsonData);
    request.end();
    //console.log("MAILCHIMP "+fName,lName,email);
}

app.listen(8080, function (request, response){
    console.log("Server is running on 8080");
});