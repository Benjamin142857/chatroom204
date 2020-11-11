
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , multiparty = require("multiparty")
  , images = require("images");

var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server,{log:false});
var clients = [];
var users = [];
var oldSocket = "";
var getDiffTime = function()
{
  if(disconnect)
  {
    return connect - disconnect;
  }
  return false;
}
io.sockets.on('connection',function(socket){
  socket.on('online',function(data){
    var data = JSON.parse(data);
    //检查是否是已经登录绑定
    if(!clients[data.user])
    {
      //新上线用户，需要发送用户上线提醒,需要向客户端发送新的用户列表
      users.unshift(data.user);
      for(var index in clients)
      {
        clients[index].emit('system',JSON.stringify({type:'online',msg:data.user,time:(new Date()).getTime()}));
        clients[index].emit('userflush',JSON.stringify({users:users}));
      }
      socket.emit('system',JSON.stringify({type:'in',msg:'',time:(new Date()).getTime()}));
      socket.emit('userflush',JSON.stringify({users:users}));
    }
      clients[data.user] = socket;
      socket.emit('userflush',JSON.stringify({users:users}));
  });
  socket.on('say',function(data){
    //dataformat:{to:'all',from:'Nick',msg:'msg'}
    data = JSON.parse(data);
    var msgData = {
      time : (new Date()).getTime(),
      data : data
    }
    if(data.to == "all")
    {
      //对所有人说
      for(var index in clients)
      {
        clients[index].emit('say',msgData);
      }
    }
    else
    {
      //对某人说
      clients[data.to].emit('say',msgData);
      clients[data.from].emit('say',msgData);
    }
  });
  socket.on('offline',function(user){
    socket.disconnect();
  });
  socket.on('disconnect',function(){
    //有人下线
    setTimeout(userOffline,5000);
    function userOffline()
    {
      for(var index in clients)
      {
        if(clients[index] == socket)
        {
          users.splice(users.indexOf(index),1);
          delete clients[index];
          for(var index_inline in clients)
          {
            clients[index_inline].emit('system',JSON.stringify({type:'offline',msg:index,time:(new Date()).getTime()}));
            clients[index_inline].emit('userflush',JSON.stringify({users:users}));
          }
          break;
        }
      }
    }
  });
});

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  // app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function (req, res, next) {
  if(!req.headers.cookie)
  {
    res.redirect('/signin');
    return;
  }
  var cookies = req.headers.cookie.split("; ");
  var isSign = false;
  for(var i = 0 ; i < cookies.length; i ++)
  {
    cookie = cookies[i].split("=");
    if(cookie[0]=="user" && cookie[1] != "")
    {
      isSign = true;
      break;
    }
  }
  if(!isSign)
  {
    res.redirect('/signin');
    return;
  }
  res.sendfile('views/index.html');
});
app.get('/signin',function(req,res,next){
  res.sendfile('views/signin.html');
});
app.get('/signup',function(req,res,next){
  res.sendfile('./views/signup.html');
});
app.post('/signin',express.bodyParser(),function(req,res,next){
  if (users.includes(req.body.username)) {
    res.json({ retCode: -1, errMsg: '该用户名已在聊天室中, 请尝试换一个.' })
  }
  else {
    res.cookie("user",req.body.username);
    res.redirect('/');
  }
});
app.get('/signout',express.bodyParser(),function(req,res,next){
  res.cookie("user", '', { expires: new Date(0)});
  res.cookie("isLogin", '', { expires: new Date(0)});
  res.json({ retCode: 0 })
});
app.post('/uploadImage', function(req, res, next) {
  //生成multiparty对象，并配置上传目标路径
  var form = new multiparty.Form({ uploadDir: './public/upload' });
  form.parse(req, function(err, fields, files) {
    if (err) {
    } else {
      var fileName = path.basename(files.file[0].path);
      var compressFileName = `compress_${fileName}`;

      // 存放略缩图
      images(`./public/upload/${fileName}`) //Load image from file
          .size(200) //等比缩放图像到400像素宽
          .save(`./public/upload/${compressFileName}`, {quality : 50});
      res.json({ imgSrc: `/upload/${compressFileName}` })
    }
  });
});
app.get('/bigImg', function(req, res, next) {
  var compressFileName = req.query.name;
  var fileName = '';
  if (compressFileName.indexOf('compress_') === 0) {
    fileName = compressFileName.slice(9);
  }
  else {
    res.json({ retCode: -1, imgSrc: 'the fileName not a compress png' });
  }
  res.json({ retCode: 0, imgSrc: `/upload/${fileName}` });
});
server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
