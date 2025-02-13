# Título: AI Coding Tutor

## Breve descripción
Proyecto multidisciplinar que integra una extensión de VS Code, un servicio backend en Go y componentes de IA en Python para ofrecer sugerencias y mejoras en tiempo real en el código. La extensión monitorea los cambios y, mediante una interfaz intuitiva, permite solicitar recomendaciones que se procesan en el backend y se devuelven a través de modelos de IA, mejorando la calidad y eficiencia del desarrollo. Además, se comparten definiciones gRPC y se utilizan contenedores Docker para facilitar el despliegue y la integración.

## Servicios, herramientas y aplicaciones implicadas en el proyecto
- **Frontend:**
  - Extensión de VS Code desarrollada en TypeScript.
  - Herramientas de Node.js, npm y Yeoman para la generación y gestión del proyecto.
  - (Opcional) Sitio web complementario bajo el mismo directorio `frontend/`, facilitando la gestión de proyectos de interfaz de usuario.

- **Backend:**
  - Servicio en Go para procesar solicitudes y orquestar la comunicación entre la extensión y los modelos de IA.

- **Inteligencia Artificial:**
  - Componentes en Python para análisis semántico y generación de sugerencias.
  - Uso de frameworks y bibliotecas de Machine Learning.
  - Entorno virtual dedicado y gestión de dependencias a través de `requirements.txt`.

- **Comunicación y Contratos:**
  - Definiciones gRPC compartidas en archivos `.proto` para asegurar interfaces consistentes entre servicios.

- **Contenerización y Despliegue:**
  - Docker para configurar entornos y facilitar el despliegue de cada componente.
  - Servicios en la nube (por ejemplo, AWS, Google Cloud o Azure) para hospedar el backend y los servicios de IA, garantizando escalabilidad y alta disponibilidad.

- **Integración y CI/CD:**
  - Herramientas de integración continua y despliegue (CI/CD) para automatizar tests y despliegues en un entorno multi-servicio.


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
