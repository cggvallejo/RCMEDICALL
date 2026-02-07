import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- Database Connection ---
// IMPORTANTE: Configurar MONGO_URI en Google Cloud Run -> Variables de Entorno
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm_medicall'; 

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Conectado"))
  .catch(err => console.error("❌ Error MongoDB:", err));

// --- Schemas & Models ---
const visitSchema = new mongoose.Schema({
    id: String,
    date: String,
    time: String,
    note: String,
    objective: String,
    followUp: String,
    outcome: String,
    status: String
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
    day: String,
    time: String,
    active: Boolean
}, { _id: false });

const doctorSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    category: { type: String, default: 'MEDICO' },
    executive: String,
    name: String,
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
    isInsuranceDoctor: Boolean,
    visits: [visitSchema],
    schedule: [scheduleSchema]
}, { minimize: false, strict: false });

const procedureSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
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
});

const Doctor = mongoose.model('Doctor', doctorSchema);
const Procedure = mongoose.model('Procedure', procedureSchema);

// --- API Routes ---
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/doctors', async (req, res) => {
    const data = req.body;
    try {
        const result = await Doctor.findOneAndUpdate(
            { id: data.id },
            data,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/doctors/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await Doctor.deleteOne({ id: id });
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/procedures', async (req, res) => {
    try {
        const procedures = await Procedure.find();
        res.json(procedures);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Static Frontend Serving ---
app.use(express.static(__dirname));

// Manejo de rutas SPA para React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Puerto dinámico para Cloud Run (puerto 8080)
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor CRM escuchando en el puerto ${PORT}`);
});
