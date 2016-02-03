/*
 * Imports
 */
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var serveIndex = require('serve-index');
const fs = require('fs');

var omx = require('omxdirector').enableNativeLoop();

// Set up the path to the delay video
const delayVideoPath == __dirname + '/public/delay.mpeg'

// Add all of our routes
require('./routes.js')(app);

// Serve folders from the file structure using serveIndex
app.use('/filesystem', serveIndex('/', {'icons': true,
                              'template': 'public/filesystem-browser.html'}));

io.on('connection', function (socket){
  console.log('client connected');

  // Listen for file grab messages
  socket.on('get-files', function(folder){
    // Fetch the file list
    var fileList = fs.readdir(folder, function(err, files){
      if (err){
        console.log(err);
      }
      else {
        // Create a new array with only the files (not directories) in the directory
        var fileArray = [];
        files.forEach(function(item){
          if (fs.lstatSync(folder + "/" + item).isFile() === true){
            fileArray.push(item);
          }
        });
        // Send these back to the frontend
        socket.emit('file-list', fileArray);
      };
    });
  });

  // Listen for status requests
  socket.on('get-status', function(){
    sendStatus(omx, socket);
  });

  // Listen for play requests
  socket.on('play', function(response){
    // Get the player status
    var statusResponse = omx.getStatus();
    // If either we're playing or we're stopped
    if (statusResponse.loaded === false || statusResponse.playing === true){
      // Create a new array to store the playlist
      var playlist = [];
      // Join all of the filenames with the chosen directory and put them on the playlist
      response.playlist.each(function(idx, val){
        playlist.push(response.folder + val);
      });
      // If the delay is not empty
      if (response.delay !== ''){
        // We have to insert delays into the playlist
        // Get the amount of time requested
        delayTime = Math.ceil(parseInt(response.delay));
        // Create a new array to store the playlist with inserted blank videos
        var playlistWithDelays = [];
        playlist.each(function(idx, value){
          // For each element in the playlist, push the correct number of delay videos onto the playlist
          playlistWithDelays.push(value);
          for (var i = 0; i < delayTime; i++){
            playlistWithDelays.push(delayVideoPath);
          };
        });
        // Finally swap the new playlist for the old one
        playlist = playlistWithDelays;
      };
      // Start playing
      omx.play(playlist, {loop: response.loop, audioOutput: response.audioOutput, letterbox: true});
    }
    // We're paused, so just unpause
    else {
      omx.play();
    };
  });

  // Listen for stop requests
  socket.on('stop', function(){
    omx.stop();
  });

  // Listen for pause requests
  socket.on('pause', function(){
    omx.pause();
  });

  // Listen for play, pause and stop actions on the omx and send status updates to the frontend
  omx.on('play', function(){
    sendStatus(omx, socket);
  });
  omx.on('stop', function(){
    sendStatus(omx, socket);
  });
  omx.on('pause', function(){
    sendStatus(omx, socket);
  });
});

http.listen(3000, function(){
  console.log('listening on localhost:3000');
});

function sendStatus(omx, socket) {
    // Get status and respond via socket
    var response = omx.getStatus();
    socket.emit('status', response);
}
