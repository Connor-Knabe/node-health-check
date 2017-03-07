var request = require('request');
var nodemailer = require('nodemailer');
var express = require('express');
var retry = require('retry');
var twilio = require('twilio');
var loginInfo = require('./settings/loginInfo.js');
var config = require('./settings/servicesConfig.js');
var client = twilio(loginInfo.TWILIO_ACCOUNT_SID, loginInfo.TWILIO_AUTH_TOKEN);
var app = express();

var services = config.services;
var retryConfig = config.retry;
var alertGroup = config.alertGroup;

var port = process.env.PORT || 2615;
var router = express.Router();
app.listen(port);
console.log('Magic happens on port ' + port +' - '+ new Date());
app.get('/', function(req,res){
    res.send({'status':'200'});
});

checkForValidAlerts(alertGroup);
populateServicesObj();

if(config.debugMode){
	intervalTime = config.debugIntervalTime;
}

setInterval(function(){
    for (var i=0;i<services.length;i++){
        checkServiceHealth(services[i].name,services[i].ip+':'+services[i].port+config.healthCheckEndpoint);
    }
}, config.intervalTime*60*1000);

function serviceObjectFromName(serviceName){
    var found = services.filter(function(item) { return item.name === serviceName; });
    return found[0];
}

function sendMessage(alertInfo, msgContent){
    if(alertInfo) {
		for (var i = 0; i < alertInfo.length; i++) {
            if(alertInfo[i].email){
                console.log(new Date(), ' Sending email: ', +msgContent);
                sendEmail(alertInfo[i],msgContent);
            }
            if(alertInfo[i].number){
                console.log(new Date(), ' Sending text: ', +msgContent);
                sendText(alertInfo[i],msgContent);
            }
		}
	}
}

function sendText(alertInfo, msgContent){
    if(!config.debugMode){
        client.messages.create({
            to: alertInfo.number,
            from: loginInfo.twilioFromNumber,
            body: msgContent
        }, function(err, message) {
            if(err){
                console.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
            }
        });
    } else {
        console.log('not sending text in debug mode');
    }
}

function sendEmail(alertInfo, msgContent){
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: loginInfo.gmailUsername,
            pass: loginInfo.gmailPass
        }
    });
    var mailOptions = {
        from: loginInfo.gmailUsername,
        to: alertInfo.email,
        subject: 'Server down Alert!',
        text: msgContent
    };
    if(!config.debugMode){
        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                return console.log(error);
            }
            console.log(new Date(),' Email sent: ');
        });
    } else {
        console.log(new Date(), 'not sending email in debug mode');
    }

}

function sendAlert(serviceObj, isOnline){
    var serviceName = serviceObj.name;
        if(isOnline){
            sendMessage(serviceObj.alertInfo,serviceName+' is online!');
            console.log(new Date()+serviceName+' is online!');
            serviceObj.needsToSend = true;
        } else if(serviceObj.needsToSend) {
            sendMessage(serviceObj.alertInfo,serviceName+' is offline!');
            console.log(new Date()+serviceName+' is offline!');
            serviceObj.needsToSend = false;
        }
}

function retryRequest(name, ip, cb ){
    var operation = retry.operation(retryConfig);
    operation.attempt(function(currentAttempt) {
        request(ip, function (error, response, body) {
            if(operation.retry(error)){
                return;
            }
            cb(error ? operation.mainError() : null, name, ip);
        });
    });
}

function checkServiceHealth(name,ip){
    retryRequest(name,ip, function(err, name, ip){
        var serviceObj = serviceObjectFromName(name);
        if(err){
            serviceObj.isOnline = false;
            sendAlert(serviceObj,serviceObj.isOnline);
        } else if (!serviceObj.isOnline) {
			serviceObj.isOnline = true;
            sendAlert(serviceObj,serviceObj.isOnline);
        }
    });
}

function populateServicesObj(){
    for (var i=0;i<services.length;i++){
        services[i].isOnline = true;
        services[i].needsToSend = true;
    }
}

function checkForValidAlerts(alertGroup){
    for (var key in alertGroup) {
        // skip loop if the property is from prototype
        if (!alertGroup.hasOwnProperty(key)) continue;
        var obj = alertGroup[key];
        for (var prop in obj) {
            // skip loop if the property is from prototype
            if(!obj.hasOwnProperty(prop)) continue;
            if(!obj[prop].number && !obj[prop].email){
                console.error('Need a number or email for alert group:', key, '\nFor user:', obj[prop]);
            }
        }
    }
}
