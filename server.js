const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// --- Configuración e Inicialización ---
const app = express();
// Límite aumentado para soportar cargas masivas de imágenes o datos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "DELETE", "PUT"] }
});

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm_medicall_v6';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conectado a MongoDB'))
    .catch(err => {
        console.error('❌ Error conectando a MongoDB:', err);
        // No detener el proceso, permitir reintentos o funcionamiento limitado si fuera necesario
    });

// --- Schemas & Models ---

const VisitSchema = new mongoose.Schema({
    id: String,
    date: String,
    time: String,
    note: String,
    objective: String,
    followUp: String,
    outcome: String,
    status: String
}, { _id: false });

const ScheduleSchema = new mongoose.Schema({
    day: String,
    time: String,
    active: Boolean
}, { _id: false });

const DoctorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true }, // Index agregado
    category: { type: String, default: 'MEDICO', index: true },      // Index agregado
    executive: { type: String, index: true },                        // Index agregado
    name: { type: String, index: true },                             // Index agregado para búsquedas
    specialty: String,
    subSpecialty: String,
    address: String,
    hospital: String,
    area: String,
    phone: String,
    email: String,
    floor: String,
    officeNumber: String,
    birthDate: String,
    cedula: String,
    profile: String,
    classification: String,
    socialStyle: String,
    attitudinalSegment: String,
    importantNotes: String,
    isInsuranceDoctor: { type: Boolean, default: false },
    visits: [VisitSchema],
    schedule: [ScheduleSchema]
}, { timestamps: true });

const ProcedureSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    date: String,
    time: String,
    hospital: String,
    doctorId: String,
    doctorName: String,
    procedureType: String,
    paymentType: String,
    cost: Number,
    commission: Number,
    technician: String,
    notes: String,
    status: String
}, { timestamps: true });

const Doctor = mongoose.model('Doctor', DoctorSchema);
const Procedure = mongoose.model('Procedure', ProcedureSchema);

// --- Socket.IO ---
io.on('connection', (socket) => {
    // console.log('⚡ Cliente conectado:', socket.id);
    socket.on('disconnect', () => {
        // console.log('⚡ Cliente desconectado:', socket.id);
    });
});

// --- API Routes ---

// 1. GET Doctors (Optimizado con projection si fuera necesario en el futuro)
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find({}).sort({ updatedAt: -1 });
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. SEED Doctors (Carga Masiva Inicial)
app.post('/api/seed', async (req, res) => {
    try {
        const count = await Doctor.countDocuments();
        if (count > 0) {
            return res.status(200).json({ message: 'La base de datos ya tiene datos.', count });
        }
        
        const doctorsData = req.body;
        if (!Array.isArray(doctorsData) || doctorsData.length === 0) {
            return res.status(400).json({ message: 'Datos inválidos para seeding.' });
        }

        await Doctor.insertMany(doctorsData);
        console.log(`✅ Base de datos poblada con ${doctorsData.length} registros.`);
        res.json({ success: true, count: doctorsData.length });
    } catch (error) {
        console.error("Error en seeding:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. CREATE / UPDATE Doctor
app.post('/api/doctors', async (req, res) => {
    const data = req.body;
    try {
        const updatedDoctor = await Doctor.findOneAndUpdate(
            { id: data.id },
            data,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        io.emit('server:doctor_updated', updatedDoctor);
        res.json(updatedDoctor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE Doctor
app.delete('/api/doctors/:id', async (req, res) => {
    try {
        await Doctor.findOneAndDelete({ id: req.params.id });
        io.emit('server:doctor_deleted', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. DELETE Visit
app.delete('/api/doctors/:doctorId/visits/:visitId', async (req, res) => {
    const { doctorId, visitId } = req.params;
    try {
        const updatedDoctor = await Doctor.findOneAndUpdate(
            { id: doctorId },
            { $pull: { visits: { id: visitId } } },
            { new: true }
        );
        if (updatedDoctor) {
            io.emit('server:doctor_updated', updatedDoctor);
            res.json(updatedDoctor);
        } else {
            res.status(404).json({ message: "Doctor no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Procedures Routes
app.get('/api/procedures', async (req, res) => {
    try {
        const procedures = await Procedure.find({}).sort({ date: -1 });
        res.json(procedures);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/procedures', async (req, res) => {
    const data = req.body;
    try {
        const updatedProcedure = await Procedure.findOneAndUpdate(
            { id: data.id },
            data,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        io.emit('server:procedure_updated', updatedProcedure);
        res.json(updatedProcedure);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/procedures/:id', async (req, res) => {
    try {
        await Procedure.findOneAndDelete({ id: req.params.id });
        io.emit('server:procedure_deleted', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SERVING FRONTEND ---
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CRM Server corriendo en puerto ${PORT}`);
});