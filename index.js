const express = require('express');
const path = require('path');
const { engine } = require('express-handlebars');
const port = process.env.PORT || 3000;
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
    connectionStateRecovery: {}
});
const cookieParser = require('cookie-parser');
const session = require('express-session');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({
    extended : true
}));
app.use(express.json());
app.use(cookieParser());
app.engine('hbs', engine({
    extname: '.hbs'
}));
app.set('view engine', 'hbs');
app.set('views', './resources/views');

server.listen(port, function () {
    console.log(`Đang lắng nghe tại port:${port}`);
});

app.get("/", function (req, res) {
    res.render('login');
});

app.get("/admin62",function(req,res) {
    res.render('admin')
})

app.post("/chat", function (req, res) {
    let username = req.body.username
    res.cookie('username',username,{maxAge : 900000, httpOnly: true})
    res.render('chat');
});



let users = [];
let connects = {}
let messages = []

function pushMessages(type,data,own) {
    messages.push({
        type : type,
        data : data,
        own : own
    })
}

io.of('/admin62').on("connection",function(socket) {
   socket.on('clearMes',function() {
    messages.splice(0, messages.length)
    console.log(messages)
   })
})

io.of('/').on("connection", function (socket) {
    socket.on('checkUserName', function (data) {
        if (users.includes(data)) socket.emit('server send checkUserName', false);
        else {
            socket.emit('server send checkUserName', true);
            users.push(data)
        }
    });
});

io.of('/chat').on("connection", function (socket) {
    socket.emit('server get infor')
    let id
    socket.on('setInfor',function(data) {
        socket.emit('loadMessages',messages)
        socket.userName = data.username
        id = data.username
        connects[id] = true
        if(data.visited == 1) {
            socket.emit("server notification", { userName: socket.userName, mes: 'vừa kết nối'});
            socket.broadcast.emit("server notification", { userName: socket.userName, mes: 'vừa kết nối'});
            pushMessages('noti','vừa kết nối',socket.userName)
        }
        socket.emit("server send username",socket.userName)
        socket.emit("server render users",users)
        socket.broadcast.emit("server render users",users)

        socket.on('typing', function (data) {
            let obj = {
            userName: socket.userName,
            id: socket.id,
            data: data
            };
            socket.broadcast.emit('server send typing', obj);
        });
        
        socket.on('client send data', function (mes) {
            let data = {
            userName: socket.userName,
            id: socket.id,
            mes: mes
            };
            socket.emit('server send me', data);
            socket.broadcast.emit('server send other', data);
            pushMessages('mes',mes,socket.userName)
        });
    })

    socket.on('disconnect', function () {
        connects[id] = false
        setTimeout(function() {
            if(!connects[id]) {
                socket.emit("server notification", { userName: id, mes: 'vừa ngắt kết nối' });
                socket.broadcast.emit("server notification", { userName: id, mes: 'vừa ngắt kết nối' });
                users.splice(users.indexOf(id),1)
                socket.broadcast.emit("server render users",users)
                pushMessages('noti',`vừa ngắt kết nối`,id)
                socket.broadcast.emit('server send typing', {data : 'stop typing'});
                delete connects[id]
            }
        },3000)
    });
});
