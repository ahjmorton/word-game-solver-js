"use strict"

define(["app/local-resources","app/local-resources-loader"], 
    function(resources) {
        var LETTERS_PER_WORKER = 4;
        var WORKER_SCRIPT = "js/app/worker.js";
        var stoppers = {}
        function sublists(array, size) {
            return array.reduce(function (previousValue, nextValue, index) {
                if (index % size === 0) {
                    previousValue.push([nextValue]);
                } else {
                    previousValue[previousValue.length - 1].push(nextValue);
                }
                return previousValue;
            }, []);
        };
        return {
            startWork: function(grid, resultFunc, stopFunc) {
                var wordListObj = resources.getWordList();
                var markovObj = resources.getMarkovChain();
                resultFunc = resultFunc || function () {};
                stopFunc = stopFunc || function() {};
                var assignments = sublists(grid, LETTERS_PER_WORKER);
                var gridToSendToWorkers = sublists(grid, 4);
                var results = {};
                stoppers = {};
                for (var i = 0; i < assignments.length; i++) {
                    var worker = new Worker(WORKER_SCRIPT);
                    worker.postMessage({
                        cmd: "start",
                        grid: gridToSendToWorkers,
                        wordList: wordListObj,
                        markov: markovObj,
                        letters: assignments[i]
                    });
                    var cleanup = function(workerId) {
                        return function() {
                            delete stoppers[workerId];
                            stopFunc(workerId, Object.keys(stoppers));
                        };
                    }(i);
                    worker.addEventListener('message', function(cleanupFunc) {
                        return function(msgData)  {
                            msgData = msgData.data;
                            switch(msgData.cmd) {
                                case "result" :
                                    resultFunc(msgData.word);
                                    break;
                                case "closing" :
                                    cleanupFunc();
                                    break;
                            }
                        }
                    }(cleanup));
                    stoppers[i] = function(toClose, cleanupFunc) {
                        return function () {
                            toClose.terminate();
                            cleanupFunc();
                        };
                    }(worker, cleanup);
                    results[i] = assignments[i];
                 }
                 return results;
            },
            stopWork: function() {
                for(var prop in stoppers) {
                    stoppers[prop]();
                }
            }
        };
    }
);
