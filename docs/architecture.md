---
config:
  theme: neo-dark
  layout: dagre
---
flowchart LR
 subgraph FComp["Frontend Components"]
        WEB["Web Interface"]
        EXT["IDE Extension"]
  end
 subgraph PRES["Presentation Layer"]
    direction TB
        FE["Frontend"]
        FComp
  end
 subgraph BUS["Business Layer"]
    direction TB
        HAND["Handlers"]
        MID["Middleware"]
        SERV["Services"]
        MOD["Models"]
  end
 subgraph DATA["Data Layer"]
    direction TB
        DB[("Database")]
        AI["AI Services"]
  end
    FE --> HAND
    WEB --> HAND
    EXT --> HAND
    HAND --> MID
    MID --> SERV
    SERV --> MOD & AI
    MOD --> DB
    style FComp fill:#fff7e6,stroke:#fe9f0b,stroke-dasharray: 4 2
    style PRES fill:#fef2e6,stroke:#fe9f0b,stroke-width:2px
    style BUS fill:#e6f7ff,stroke:#0b69fe,stroke-width:2px
    style DATA fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
