# RC MediCall CRM - Elite v5 (Cloud Native)

## 🚀 Despliegue en Google Cloud Run

Para desplegar este proyecto automáticamente desde **GitHub**:

### 1. Preparación en GCP
1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita las siguientes APIs:
   - **Cloud Run API**
   - **Cloud Build API**
   - **Artifact Registry API**

### 2. Conexión con GitHub
1. Ve a **Cloud Build** -> **Triggers**.
2. Haz clic en **Manage Repositories** y conecta tu cuenta de GitHub.
3. Crea un nuevo disparador (Trigger):
   - **Event**: Push to a branch (ej: main).
   - **Configuration**: Autodetected (usará el archivo `cloudbuild.yaml`).

### 3. Variables de Entorno
En la configuración de Cloud Run, asegúrate de añadir la variable `MONGO_URI` apuntando a tu instancia de **MongoDB Atlas** para que los datos sean persistentes fuera del contenedor.

### 🛠 Tecnología
- **Runtime**: Node.js 20 (Containerized)
- **Frontend**: React 19.2.4 (Strict)
- **CI/CD**: Google Cloud Build
- **Infraestructura**: Google Cloud Run (Serverless)
