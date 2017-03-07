module.exports.healthCheckEndpoint = '/';
module.exports.debugMode = true;
module.exports.intervalTime = 0.1;
module.exports.debugIntervalTime = 0.1;
module.exports.retry = {
    retries: 2,
    factor: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
    randomize: true,
};

//People to alert
var alertGroup = {
    missionCriticalAlertInfo : [
        {
            name:'Connor',
            number:'314-555-5555'
        }
    ],
    groupOneAlertInfo : [
        {
            name:'Bob',
            number:'314-555-5555',
            email:'bob@test.com'
        },
        {
            name:'This will fail (needs number or email)'
        }
    ]
};

module.exports.alertGroup = alertGroup;


//Services info ip port name etc..
var ServerOneIp = 'https://duckduckgo.com';
module.exports.services = [
    {
        name:'DDG',
        server:'DuckDuckGo',
        ip: ServerOneIp,
        port:'80',
        alertInfo:alertGroup.missionCriticalAlertInfo,
        route:'/healthCheck'
    },
    {
        name:'Simple banking',
        server:'Simple',
        ip:"https://simple.com",
        port:'80',
        alertInfo:alertGroup.missionCriticalAlertInfo
    },
    {
        name:'Betterment',
        server:'Betterment server',
        ip:"https://betterment.com",
        port:'80',
        alertInfo:alertGroup.groupOneAlertInfo
    }
];
