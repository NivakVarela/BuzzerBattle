const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000;

mongoose.connect('mongodb://localhost:27017/juegoDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Definir el modelo de Sala
const salaSchema = new mongoose.Schema({
  codigo: String,
  privada: Boolean,
  preguntas: [String],
  participantes: [{ nombre: String, respuesta: String }],
});

const Sala = mongoose.model('Sala', salaSchema);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', async (req, res) => {
  const salas = await Sala.find();
  res.render('index', { salas });
});

app.get('/sala/:codigo', async (req, res) => {
  const codigo = req.params.codigo;
  const sala = await Sala.findOne({ codigo });
  res.render('sala', { sala });
});

app.post('/crear-sala', async (req, res) => {
  const { codigo, privada } = req.body;
  const nuevaSala = new Sala({ codigo, privada: privada === 'true', preguntas: [], participantes: [] });
  await nuevaSala.save();
  res.redirect('/');
});

server.listen(PORT, () => {
  console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});

// Configurar Socket.io para la comunicación en tiempo real
io.on('connection', (socket) => {
  console.log('Usuario conectado');

  socket.on('unirse-sala', async (data) => {
    const { salaCodigo, nombre } = data;
    const sala = await Sala.findOne({ codigo: salaCodigo });
    if (sala) {
      socket.join(salaCodigo);
      io.to(salaCodigo).emit('mensaje', `${nombre} se unió a la sala.`);
      io.to(salaCodigo).emit('actualizar-participantes', sala.participantes);
    }
  });

  socket.on('enviar-respuesta', async (data) => {
    const { salaCodigo, nombre, respuesta } = data;
    const sala = await Sala.findOne({ codigo: salaCodigo });
    if (sala) {
      sala.participantes.push({ nombre, respuesta });
      await sala.save();
      io.to(salaCodigo).emit('actualizar-participantes', sala.participantes);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado');
  });
});
