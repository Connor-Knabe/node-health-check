// var request = require('request');
var nodemailer = require('nodemailer');
var express = require('express');
var twilio = require('twilio');
var loginInfo = require('./settings/loginInfo.js');
var config = require('./settings/servicesConfig.js');
var client = twilio(loginInfo.TWILIO_ACCOUNT_SID, loginInfo.TWILIO_AUTH_TOKEN);
var app = express();
var dns = require('dns');
var retry = require('retry');
var request = require('request');

var services = config.services;
var alertGroup = config.alertGroup;
var retryAttempts = config.retryAttempts;
var retryConfig = config.retry;


var port = process.env.PORT || 2615;
var router = express.Router();
app.listen(port);
console.log('Magic happens on port ' + port +' - '+ new Date());
app.get('/', function(req,res){
    res.send({'status':'200'});
});

checkForValidAlerts(alertGroup);
populateServicesObj(services);
var intervalTime = config.intervalTime;
if(config.debugMode){
	intervalTime = config.debugIntervalTime;
	retryAttempts = config.debugRetryAttempts;
	console.log('_____________________________\nIn debug mode will not send any alerts!!\n_____________________________');
	allServicesCheck(services);
}


setInterval(function(){
    allServicesCheck(services);
}, intervalTime*60*1000);


function allServicesCheck(services){
    for (var i=0;i<services.length;i++){
        var healthCheckEndPoint = services[i].route ? services[i].route : config.healthCheckEndpoint;
        var port = services[i].port ? ':'+services[i].port : '';
        console.log("checking", services[i].name);
		checkServiceHealth(services[i].ip+port+healthCheckEndPoint,services[i],services);
    }
}

function serviceObjectFromName(serviceName,servicesArray){
    var found = servicesArray.filter(function(item) { return item.name === serviceName; });
    return found[0];
}

function sendMessage(alertInfo, msgContent){
    if(alertInfo) {
		for (var i = 0; i < alertInfo.length; i++) {
            if(alertInfo[i].email){
                sendEmail(alertInfo[i],msgContent);
            }
            if(alertInfo[i].number){
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
            } else {
                console.log(new Date(),' Text sent: ', msgContent);
            }
        });
    } else {
        console.log('not sending text in debug mode',msgContent);
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
            console.log(new Date(),' Email sent: ', msgContent);
        });
    } else {
        console.log(new Date(), 'not sending email in debug mode', msgContent);
    }

}

function sendAlert(serviceObj, isOnline){
    var serviceName = serviceObj.name;
    if(isOnline){
        sendMessage(serviceObj.alertInfo,serviceName+' is online!');
        serviceObj.needsToSend = true;
    } else if(serviceObj.needsToSend) {
        sendMessage(serviceObj.alertInfo,serviceName+' is offline!');
        serviceObj.needsToSend = false;
    }
}




//new
function retryRequest(serviceObj, ip, cb){
    console.log('retry request',serviceObj.name,ip);
    var operation = retry.operation(retryConfig);
    operation.attempt(function(currentAttempt) {
        var requestObj = request;
        if(serviceObj.isAlternateHealthCheck){
            request.put({strictSSL:false,timeout:40000, url: ip,  form: {access_token:config.accessToken}}, function (error, response, body) {
                var statusCode = response && response.statusCode ? response.statusCode : null;
                body = JSON.parse(body);
                if(statusCode!=200 && statusCode!=401 || !body.online){
                    console.log('errror',serviceObj.name);
                    error = new Error('Invalid route for '+ serviceObj.name);
                } else if(serviceObj.dependantServices) {
                    console.log(new Date(),'checking all services');
                    allServicesCheck(serviceObj.dependantServices);
                }
                if(operation.retry(error)){
                    return;
                }
                cb(error ? operation.mainError() : null, serviceObj.name, ip);
            });
        } else{
            request({strictSSL:false,timeout:3000, url: ip}, function (error, response, body) {
                var statusCode = response && response.statusCode ? response.statusCode : null;
                if(statusCode!=200 && statusCode!=401){
                    console.log('errror',serviceObj.name);
                    error = new Error('Invalid route for '+ serviceObj.name);
                } else if(serviceObj.dependantServices) {
                    console.log(new Date(),'checking all services');
                    allServicesCheck(serviceObj.dependantServices);
                }
                if(operation.retry(error)){
                    return;
                }
                cb(error ? operation.mainError() : null, serviceObj.name, ip);
            });
        }
        
    });
}



//mixed
function checkServiceHealth(ip,serviceObject,serviceArray){
    //new
    retryRequest(serviceObject,ip, function(err, name, ip){
        if(err){
            console.log('offline');
            serviceObject.isOnline = false;
            sendAlert(serviceObject,serviceObject.isOnline);
        } else if (!serviceObject.isOnline) {
            console.log('online');
            serviceObject.isOnline = true;
            sendAlert(serviceObject,serviceObject.isOnline);
        }
    });
}

function populateServicesObj(services){
    var i=0;

    while(i<services.length){
        services[i].isOnline = true;
        services[i].needsToSend = true;
        if(services[i].dependantServices){
            populateServicesObj(services[i].dependantServices);
        }
        i++;
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
