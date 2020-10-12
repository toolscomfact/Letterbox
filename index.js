//#region Load Modules
const util = require('util');
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("express");
const cookieParser = require('cookie-parser');
const redis = require("redis");
const https = require("https");
const fs = require("fs");
const { randomInt } = require("crypto");
const { EDEADLK } = require('constants');
//#endregion

//#region Redis
let redisClient = redis.createClient(32768, "localhost");

redisClient.lindexRange = util.promisify(redisClient.lindex);
redisClient.lrangeAsync = util.promisify(redisClient.lrange);
redisClient.lindexAsync = util.promisify(redisClient.lindex);
redisClient.llenAsync = util.promisify(redisClient.llen);
redisClient.lpushAsync = util.promisify(redisClient.lpush);
redisClient.rpushAsync = util.promisify(redisClient.rpush);
redisClient.lpopAsync = util.promisify(redisClient.lpop);
redisClient.rpopAsync = util.promisify(redisClient.rpop);
redisClient.lsetAsync = util.promisify(redisClient.lset);
redisClient.lposAsync = util.promisify(redisClient.lpos);
redisClient.delAsync = util.promisify(redisClient.del);
//#endregion

//#region Pre initialized function
function randomName() {
    return (Math.random()+1).toString(36).substring(2);
}

function getAvailableWord(progression, progressionLearnRate) {
    let counter = 0;   
    let wordsLength = progression.dictionaryArray.length;
    
    while (true){
        if (counter >= wordsLength){
            return null;
        }

        counter ++;

        let index = 0;
        if (wordsLength >= 2){
            index = randomInt(0, wordsLength-1);
        }
        let randWord = progression.dictionaryArray[index];

        if (randWord.correct >= progressionLearnRate){
            // 3회 이상 맞았으면 추가하지 않음
            continue;
        }

        return {
            index : index,
            word : randWord
        };
    }
};

function getRandomWord(progression) {
    let index = 0;
    let wordsLength = progression.dictionaryArray.length;

    if (wordsLength >= 2){
        index = randomInt(0, wordsLength-1);
    }

    let randWord = progression.dictionaryArray[index];

    return {
        index : index,
        word : randWord
    };
}


//#endregion

//#region Mongoose Scheme-Model
const Schema = mongoose.Schema;

let dictionarySchema = new Schema({
    dictionaryArray : {
        type : Array
    },

    dictionaryName : {
        type : String
    },

    dictionaryOwner : {
        type : String,
        default : "admin"
    },

    usingCount : {
        type: Number,
        default: 0
    },

    shareSuffix : {
        type : String,
        default : null
    }
});

let userProgressionSchema = new Schema({

    userId : {
        type : String
    },

    progressName : {
        type : String
    },

    startDate : {
        type : Date
    },

    dictionaryArray : {
        type : Array
    },

    learnRate : {
        type : Number,
        default : 3
    }
});

let dictionaryModel = mongoose.model("Dictionary", dictionarySchema);
let progressionModel = mongoose.model("Progression", userProgressionSchema);
//#endregion

let app = express();
app.use(bodyParser.json());
app.use(cookieParser());

let absoultePath = require('path').dirname(require.main.filename)+"/docs";

let serverBooting = async () => {
    // Mongodb Connect
    await mongoose.connect("mongodb://13.125.19.118/febrezewords");

    //#region Render sites
    app.get("", async (req, res) => {
        res.sendFile(absoultePath + "/home.html");
    });

    app.get("/main.html", async (req, res) => {
        res.sendFile(absoultePath + "/main.html");
    });

    app.get("/home.html", async (req, res) => {
        res.sendFile(absoultePath + "/home.html");
    });

    app.get("/workbook.html", async (req, res) => {
        res.sendFile(absoultePath + "/workbook.html");
    });
    
    app.get("/dictionary.html", async (req, res) => {
        res.sendFile(absoultePath + "/dictionary.html");
    });
    
    app.get("/login.html", async (req, res) => {
        res.sendFile(absoultePath + "/login.html");
    });
    //#endregion

    //#region Dictionary
    app.post("/dictionary/list", async (req, res) => {
        try{
            let dictionaryOwner = req.body.dictionaryOwner;
            let dictionaryName = req.body.dictionaryName;

            let models = null;
            let filter = {};

            if (dictionaryOwner !== undefined){
                filter["dictionaryOwner"] = dictionaryOwner;
            }

            if (dictionaryName !== undefined){
                filter["dictionaryName"] = dictionaryName;
            }

            models = await dictionaryModel.find({dictionaryOwner:dictionaryOwner}, {_id:1, dictionaryName:1, dictionaryArray:1, usingCount:1}).sort({dictionaryName : 1});
            

            res.json({
                ok : 1,
                dictionary : models
            });
        }catch(error){
            res.json({
                ok : 0,
                err : String(error)
            });
        }
    });

    app.post("/dictionary/add", async (req, res) => {
        try{
            let dictionaryArray = req.body.dictionaryArray;
            let dictionaryName = req.body.dictionaryName;
            let dictionaryOwner = req.body.dictionaryOwner;

            let newDictionary = new dictionaryModel();

            newDictionary.dictionaryName = dictionaryName;
            newDictionary.dictionaryArray = dictionaryArray;
            newDictionary.dictionaryOwner = dictionaryOwner;

            await newDictionary.save();

            res.json({
                ok : 1,
                _id : newDictionary._id
            });
        }catch(error){
            res.json({
                ok : 0,
                err : String(error)
            });
        }
    });

    app.post("/dictionary/rename", async (req, res) => {
        try{
            let dictionaryName = req.body.dictionaryName;
            let dictionaryId = req.body.dictionaryId;

            await dictionaryModel.update({
                _id : mongoose.Types.ObjectId(dictionaryId),
            }, {
                $set : {
                    dictionaryName : dictionaryName
                }
            });

            res.json({
                ok : 1
            })

        }catch(error){
            res.json({
                ok : 0,
                err : String(error)
            })
        }
    });
    
    app.post("/dictionary/remove", async (req, res) => {
        try{
            let dictionaryId = req.body.dictionaryId;

            let result = await dictionaryModel.remove({
                _id : mongoose.Types.ObjectId(dictionaryId)
            });

            res.json({
                ok : 1,
                result : result
            })

        }catch(error){
            res.json({
                ok : 0,
                err : String(error)
            })
        }
    });
    
    app.post("/dictionary/copy", async (req, res) => {
        try{
            let dictionaryId = req.body.dictionaryId;
            let dictionaryOwner = req.body.dictionaryOwner;

            let dictionary = await dictionaryModel.findOne({
                _id : mongoose.Types.ObjectId(dictionaryId)
            });

            delete dictionary._id;
            dictionary.dictionaryOwner = dictionaryOwner;

            let result = await dictionaryModel.create(dictionary);

            res.json({
                ok : 1,
                result : result
            })

        }catch(error){
            res.json({
                ok : 0,
                err : String(error)
            })
        }
    });
    
    app.post("/dictionary/share", async (req, res) => {
        try{
            let dictionaryId = req.body.dictionaryId;

            if (!await dictionaryModel.exists({_id : mongoose.Types.ObjectId(dictionaryId)})){
                throw "dictionary not exists";
            }

            let randomStr = "";
            let result = {};
            let find = await dictionaryModel.findOne({_id : mongoose.Types.ObjectId(dictionaryId)});

            if (find.shareSuffix !== null){
                randomStr = find.shareSuffix;
            }else{
                while (true){
                    randomStr = randomName();
                    
                    let count = await dictionaryModel.count({shareSuffix : randomStr});
                    if (count === 0){
                        break;
                    }
                }

                result = await dictionaryModel.update({
                    _id : mongoose.Types.ObjectId(dictionaryId)
                }, {
                    shareSuffix : randomStr
                });
            }

            res.json({
                ok : 1,
                result : result,
                suffix : randomStr
            })

        }catch(error){
            res.json({
                ok : 0,
                err : String(error)
            })
        }
    });
    
    app.get("/dictionary/share/:sharesuffix", async (req, res) => {
        let sharesuffix = req.params.sharesuffix;
        let googleUserid = req.cookies.googleUserid;

        try{
            if (googleUserid !== undefined){
                if (!await dictionaryModel.exists({shareSuffix : sharesuffix})){
                    throw "dictionary not exists";
                }else{
        
                    let dictionary = await dictionaryModel.findOne({
                        shareSuffix : sharesuffix
                    });
        

                    let newDictionary = new dictionaryModel();

                    newDictionary.dictionaryName = dictionary.dictionaryName;
                    newDictionary.dictionaryArray = dictionary.dictionaryArray;
                    newDictionary.dictionaryOwner = googleUserid;
        
                    let result = await newDictionary.save();

                    console.log(result);

                    res.cookie("modalCookie", "[\"'"+dictionary.dictionaryName+"' 단어장이 추가되었습니다. \"]")
                }
            }
        }catch (err){
            console.log(err);
            res.cookie("modalCookie", "[\"단어장을 추가하는데 실패했습니다....\"]");
        }

        res.redirect("/");
    });
    //#endregion

    //#region Progression
    app.post("/progression/get", async (req, res) => {
        try{
            let progressId = req.body.progressId;

            let progress = await progressionModel.findOne({
                _id : mongoose.Types.ObjectId(progressId)
            });

            res.json({
                ok : 1,
                progress : progress
            });
        }catch(error){  
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });

    app.post("/progression/list", async (req, res) => {
        try{
            let userId = req.body.userId;

            let progressions =  await progressionModel.find({userId : userId});

            res.json({
                ok : 1,
                progressions : progressions
            });
        }catch(error){  
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });

    app.post("/progression/create", async (req, res) => {
        try {

            let dictIds = req.body.dictIds;
            let progressionName = req.body.progressionName;
            let userId = req.body.userId;

            let ors = [];

            for (var i=0; i<dictIds.length; i++){
                console.log(i);
                ors.push({
                    "_id" : mongoose.Types.ObjectId(dictIds[i])
                })
            }

            let dictionaries = await dictionaryModel.find({
                $or : ors
            });

            let dictionaryArray = [];

            for (let i=0; i<dictionaries.length; i++){
                let dictSingleArray = dictionaries[i].dictionaryArray;
                
                dictionaryArray = dictionaryArray.concat(dictSingleArray);
            }

            for (let i=0; i<dictionaryArray.length; i++){
                let spellmean = dictionaryArray[i];
                spellmean.correct = 0;
            }

            let progression = new progressionModel();
            progression.userId = userId;
            progression.progressName = progressionName;
            progression.startDate = Date.now();
            progression.dictionaryArray = dictionaryArray;

            let result = await progression.save();

            res.json({
                ok : 1,
                _id : result._id
            });

            dictIds.forEach(async dictId => {

                await dictionaryModel.updateOne({
                    _id : mongoose.Types.ObjectId(dictId)
                }, {
                    $inc : {
                        usingCount : 1
                    }
                });
            })
        }catch (error){
            res.json({
                ok : 0,
                err : String(error)
            });
        }
    });

    app.post("/progression/rename", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;
            let rename = req.body.rename;

            await progressionModel.updateOne({_id : mongoose.Types.ObjectId(progressionId)}, {$set : {progressName : rename}});

            res.json({
                ok : 1
            });
        }catch(error){
            res.json({
                ok : 0,
                err : String(error)
            })
        }
    });
       
    app.post("/progression/remove", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;

            let result =  await progressionModel.remove({_id : mongoose.Types.ObjectId(progressionId)});

            res.json({
                ok : 1,
                result : result
            });
        }catch(error){  
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });
    //#endregion

    //#region Word
    app.post("/word/get", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;
            let progression =  await progressionModel.findOne({_id : mongoose.Types.ObjectId(progressionId)});
            let progressionLearnRate = progression.learnRate;

            let cacheName = progressionId + "_cacheList";
            let cacheLen = await redisClient.llenAsync(cacheName);

            let replace = false;
            let empty = false;

            let front ;
            let end = false;

            if (cacheLen === 0){
                empty = true;
            }else{
                front = await redisClient.lindexAsync(cacheName, 0);

                if (front === "@null"){
                    replace = true;
                }else{
                    front = JSON.parse(front);
                }
            }

            //#region 맨 앞이 비어있음!
            if (empty){
                let available = getAvailableWord(progression, progressionLearnRate);

                if (available === null){
                    end = true;
                    // 더 이상 암기할 단어 없음. 암기 완료.
                }else{
                    await redisClient.lpushAsync(cacheName, JSON.stringify(available));
                    front = available;
                    // 맨 앞에 available 을 넣음!
                }
            }
            //#endregion

            //#region 맨 앞 값이 @null 일 때!
            if (replace){
                let available = getAvailableWord(progression, progressionLearnRate);

                if (available === null){
                    end = true;
                    // 더 이상 암기할 단어 없음. 암기 완료.
                }else{
                    await redisClient.lsetAsync(cacheName, 0, JSON.stringify(available));
                    front = available;
                    console.log("@null");
                    // 맨 앞을 랜덤값으로 변경!
                }
            }
            //#endregion
            
            if (end){
                res.json({
                    ok : 2
                }); // 암기 끝!
            }else{
                res.json({
                    ok : 1,
                    problem : front,
                    answers : [getRandomWord(progression), getRandomWord(progression)]
                }); // 데이터 전달
            }
        }catch(error){  
            console.log(error);
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });

    app.post("/word/select", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;
            let index = req.body.index; // 단어 아이디
            let correct = req.body.correct; // 정답 여부
            
            let cacheName = progressionId + "_cacheList";

            let result = await redisClient.lindexAsync(cacheName, 0);
            await redisClient.lpopAsync(cacheName); // 맨 앞 값을 꺼냄.

            if (correct === true){
                let update = { "$inc" : {} };
                update["$inc"]["dictionaryArray."+index+".correct"] = 1;

                await progressionModel.updateOne({_id : mongoose.Types.ObjectId(progressionId)}, update);
            } // 정답일경우 correct ++

            let progression = await progressionModel.findOne({_id : mongoose.Types.ObjectId(progressionId)});
            let progressionLearnRate = progression.learnRate;

            let correct_val = progression.dictionaryArray[index].correct;
            
            if (correct_val < progressionLearnRate){ // 뒤에 더 추가해야함.
                for (let i=0; i<randomInt(2); i++){
                    await redisClient.lpushAsync(cacheName, "@null");
                }
                await redisClient.lpushAsync(cacheName, result);
            }

            res.json({
                ok : 1,
                result : result
            });
        }catch(error){  
            console.log(error);
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });

    app.post("/word/clear", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;

            let result = await redisClient.delAsync(progressionId + "_cacheList");

            res.json({
                ok : 1,
                result : result
            });
        }catch(error){  
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });

    app.post("/word/cache", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;

            let result = await redisClient.lrangeAsync(progressionId + "_cacheList", 0, -1);

            res.json({
                ok : 1,
                result : result
            });
        }catch(error){  
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });
    //#endregion
    
    //#region Listen
    const option = {
        ca: fs.readFileSync('/etc/letsencrypt/live/ltbox.net/fullchain.pem'),
        key: fs.readFileSync('/etc/letsencrypt/live/ltbox.net/privkey.pem', 'utf8').toString(),
        cert: fs.readFileSync('/etc/letsencrypt/live/ltbox.net/cert.pem', 'utf8').toString(),
    };
    // Https Config

    //Listen!
    // HTTPS
    https.createServer(option, app).listen(443,() => {
        console.log("443 port listen");
    });

    // HTTP
    app.listen(80, () => {
        console.log("80 port listen");
      });
    //#endregion
};

serverBooting();
