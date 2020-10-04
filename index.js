//#region Load Modules
const util = require('util');
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("express");
const redis = require("redis");
const { randomInt } = require("crypto");
//#endregion

//#region Redis
let redisClient = redis.createClient(32768, "localhost");

redisClient.lindexRange = util.promisify(redisClient.lindex);
redisClient.lrangeAsync = util.promisify(redisClient.lrange);
redisClient.llenAsync = util.promisify(redisClient.llen);
redisClient.lpushAsync = util.promisify(redisClient.lpush);
redisClient.rpushAsync = util.promisify(redisClient.rpush);
redisClient.lpopAsync = util.promisify(redisClient.lpop);
redisClient.rpopAsync = util.promisify(redisClient.rpop);
redisClient.lsetAsync = util.promisify(redisClient.lset);
redisClient.lposAsync = util.promisify(redisClient.lpos);
redisClient.delAsync = util.promisify(redisClient.del);
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

let absoultePath = require('path').dirname(require.main.filename)+"\\docs";

let serverBooting = async () => {
    // Mongodb Connect
    await mongoose.connect("mongodb://13.125.19.118/febrezewords");

    //#region Render sites
    app.get("", (req, res) => {
        res.sendFile(absoultePath + "/home.html");
    });

    app.get("/main.html", (req, res) => {
        res.sendFile(absoultePath + "/main.html");
    });

    app.get("/home.html", (req, res) => {
        res.sendFile(absoultePath + "/home.html");
    });

    app.get("/workbook.html", (req, res) => {
        res.sendFile(absoultePath + "/workbook.html");
    });
    
    app.get("/dictionary.html", (req, res) => {
        res.sendFile(absoultePath + "/dictionary.html");
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
            let progerssionId = req.body.progerssionId;
            let rename = req.body.rename;

            await progressionModel.updateOne({_id : mongoose.Types.ObjectId(progerssionId)}, {$set : {progressName : rename}});

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
    //#endregion

    //#region  Word
    app.post("/word/get", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;
            let progression =  await progressionModel.findOne({_id : mongoose.Types.ObjectId(progressionId)});

            let progressionLearnRate = progression.learnRate;

            let wordsLength = progression.dictionaryArray.length;

            let getAvailableWord = () => {
                let counter = 0;
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

            let getRandomWord = () => {
                while (true){
                    let index = 0;
                    if (wordsLength >= 2){
                        index = randomInt(0, wordsLength-1);
                    }

                    let randWord = progression.dictionaryArray[index];

                    return {
                        index : index,
                        word : randWord
                    };
                }
            }

            let cacheListLen = await redisClient.llenAsync(progressionId + "_cacheList");
            if (cacheListLen < 5){ // 0개, 1개
                let haveToFill = 5 - cacheListLen; // 0 일때는 2개, 1 일때는 1개

                for (let i=0; i<haveToFill; i++){
                    let randomWord = getAvailableWord();

                    if (randomWord !== null){
                        await redisClient.rpushAsync(progressionId  + "_cacheList", JSON.stringify(randomWord));
                    }
                }
            }

            if (await redisClient.llenAsync(progressionId + "_cacheList") > 0){
                let result = await redisClient.lrangeAsync(progressionId + "_cacheList", 0, 0)

                res.json({
                    ok : 1,
                    problem : JSON.parse(result[0]),
                    answers : [getRandomWord(), getRandomWord()]
                }); // 데이터 전달
            }else{
                res.json({
                    ok : 2
                }); // 암기 끝!
            }
        }catch(error){  
            res.json({
                ok : 0,
                error : String(error)
            })
        }
    });

    app.post("/word/select", async (req, res) => {
        try{
            let progressionId = req.body.progressionId;
            let index = req.body.index;
            let correct = req.body.correct;

            let result = await redisClient.lpop(progressionId + "_cacheList");

            if (correct === true){ // 정답일경우 correct += 1 해야 함.
                let update = { "$inc" : {} };
                update["$inc"]["dictionaryArray."+index+".correct"] = 1;

                await progressionModel.updateOne({_id : mongoose.Types.ObjectId(progressionId)}, update);
            }

            let progression = await progressionModel.findOne({_id : mongoose.Types.ObjectId(progressionId)});
            let progressionLearnRate = progression.learnRate;

            let word = progression.dictionaryArray[index];

            let getAvailableWord = (varProgression) => {
                let counter = 0;
                let wordsLength = varProgression.dictionaryArray.length;

                while (true){
                    if (counter >= wordsLength){
                        return null;
                    }
                    counter ++;

                    let index = randomInt(0, wordsLength-1);
                    let randWord = varProgression.dictionaryArray[index];

                    if (randWord.correct >= varProgression.learnRate){
                        // 3회 이상 맞았으면 추가하지 않음
                        continue;
                    }

                    return {
                        index : index,
                        word : randWord
                    };

                }
            };

            if (word.correct >= progressionLearnRate){
                // 3회 이상 맞으면 더 이상 이 단어를 추가하지 않음.
                // 랜덤 단어는 /word/get 에서 추가함.
            }else{
                while (true){
                    if (await redisClient.llenAsync(progressionId + "_cacheList") < 5){
                        await redisClient.rpushAsync(progressionId + "_cacheList", JSON.stringify({
                            index : index,
                            word : word
                        }));
                    }else{
                        let index = Math.min(Math.random(0, 4), await redisClient.llenAsync(progressionId + "_cacheList")-1);

                        let origin = await redisClient.lindexAsync(progressionId + "_readed", index);
                        let pos = await redisClient.lposAsync(progressionId + "_readded", origin)
                        
                        if (pos === null){ // Not readded
                            await redisClient.lsetAsync(progressionId  + "_cacheList", index, JSON.stringify({
                                index : index,
                                word : word
                            })); // readded    
                        }else{ // Readded !
                            continue;
                        }
                    }
                    
                    break;
                }
                // 뒤에 같은 단어 추가
            }

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

    //Listen!
    app.listen(80, () => {
        console.log("server open");
    });
};

serverBooting();
