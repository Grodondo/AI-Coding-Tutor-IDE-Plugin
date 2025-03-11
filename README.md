# Título: AI Coding Tutor

## Breve descripción
Proyecto educativo innovador que integra una extensión de VS Code, un servicio backend en Go y componentes de IA en Python para proporcionar sugerencias, explicaciones y análisis en tiempo real sobre el código. La extensión está diseñada para facilitar el aprendizaje y la enseñanza de buenas prácticas de programación, ayudando a los usuarios a entender conceptos clave y a mejorar sus habilidades de codificación. Además, se utilizan definiciones gRPC y contenedores Docker para simplificar el despliegue y la integración, creando un entorno colaborativo y escalable enfocado en el aprendizaje.

## Servicios, herramientas y aplicaciones implicadas en el proyecto
- **Frontend:**
  - Extensión de VS Code desarrollada en TypeScript, centrada en la enseñanza y la mejora de habilidades de programación.
  - Herramientas de Node.js, npm y Yeoman para la generación y gestión del proyecto.
  - (Opcional) Sitio web complementario para recursos educativos adicionales, ubicado en `frontend/website`.

- **Backend:**
  - Servicio en Go para procesar solicitudes y coordinar la comunicación entre la extensión y los componentes de IA, orientado a ofrecer explicaciones y sugerencias educativas.

- **Inteligencia Artificial:**
  - Componentes en Python para análisis semántico y generación de recomendaciones formativas.
  - Uso de frameworks y bibliotecas de Machine Learning para modelar comportamientos de enseñanza.
  - Entorno virtual dedicado y gestión de dependencias a través de `requirements.txt`.

- **Comunicación y Contratos:**
  - Definiciones gRPC compartidas en archivos `.proto` para asegurar interfaces consistentes entre servicios.

- **Contenerización y Despliegue:**
  - Docker para configurar entornos y facilitar el despliegue de cada componente.
  - Servicios en la nube (por ejemplo, AWS, Google Cloud o Azure) para hospedar el backend y los servicios de IA, garantizando escalabilidad, alta disponibilidad y un entorno educativo robusto.

- **Integración y CI/CD:**
  - Herramientas de integración continua y despliegue (CI/CD) para automatizar pruebas y despliegues en un entorno multi-servicio.


project-root/
├── frontend/
│   ├── extension/          # VS Code extension project
│   │   ├── src/            # Extension source code
│   │   ├── package.json    # Extension-specific dependencies and scripts
│   │   ├── .vscodeignore   # Files/folders to exclude when packaging the extension
│   │   └── tsconfig.json   # TypeScript configuration (if using TypeScript)
│   └── website/            # Website project (if added later)
│       ├── src/            # Website source code (React, Vue, Angular, etc.)
│       ├── public/         # Static assets for the website
│       ├── package.json    # Website dependencies and build scripts
│       └── ...             # Additional config files (webpack.config.js, etc.)
├── backend/                # Go service
│   ├── cmd/                # Main application(s) entry points
│   ├── internal/           # Internal packages (if needed)
│   └── go.mod              # Go module definition and dependencies
├── ai/                     # Python AI components
│   ├── models/             # Shared model files and logic
│   ├── training/           # Code and notebooks for model training
│   └── requirements.txt    # Python dependencies for AI components
├── proto/                  # Shared gRPC definitions (and possibly REST contracts)
│   └── *.proto           # Protocol Buffer definitions shared across services
├── docker/                 # Container configurations and Docker Compose files
│   ├── extension/          # Docker setups for the extension (if needed)
│   ├── backend/            # Dockerfile(s) for the Go service
│   ├── ai/                 # Dockerfile(s) for the Python AI service
│   └── docker-compose.yml  # Optionally orchestrate multiple containers
└── README.md               # Top-level project documentation
