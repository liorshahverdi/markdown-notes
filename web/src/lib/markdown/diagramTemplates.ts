export const diagramTemplates = {
	flowchart: `flowchart TD
    A[Start]:::green --> B{Decision}:::orange
    B -->|Yes| C[Do thing]:::blue
    B -->|No| D[Other thing]:::red
    C --> E[End]:::green
    D --> E

    classDef green fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef blue fill:#3498db,stroke:#2980b9,color:#fff
    classDef orange fill:#f39c12,stroke:#e67e22,color:#fff
    classDef red fill:#e74c3c,stroke:#c0392b,color:#fff`,
	sequence: `sequenceDiagram
    actor User
    participant App
    participant Server

    rect rgb(232, 245, 233)
        User->>App: Click button
        App->>Server: API request
    end
    rect rgb(227, 242, 253)
        Server-->>App: Response
        App-->>User: Show result
    end`,
	classDiagram: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +fetch()
    }
    class Cat {
        +purr()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
	stateDiagram: `stateDiagram-v2
    [*] --> Idle
    Idle --> Active: start
    Active --> Paused: pause
    Paused --> Active: resume
    Active --> [*]: finish`,
	erDiagram: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : includes
    CUSTOMER {
        string id
        string name
    }
    ORDER {
        string id
        date created_at
    }`,
	gantt: `gantt
    title Project Plan
    dateFormat  YYYY-MM-DD
    section Discovery
    Requirements       :done,    req, 2026-01-01, 3d
    Prototype          :active,  proto, after req, 4d
    section Delivery
    Build              :build, after proto, 5d
    QA                 :qa, after build, 2d`,
	pie: `pie title Time Allocation
    "Research" : 35
    "Build" : 45
    "QA" : 20`,
	userJourney: `journey
    title User Journey
    section Discover
      Open app: 5: User
      Import source: 4: User
    section Learn
      Read wiki page: 5: User
      Ask chat: 4: User`,
	gitGraph: `gitGraph
    commit
    branch feature
    checkout feature
    commit
    checkout main
    merge feature`,
	requirement: `requirementDiagram
    requirement vault_support {
        id: 1
        text: The app shall expose markdown files and folders as first-class UI
        risk: medium
        verifymethod: test
    }`,
	quadrantChart: `quadrantChart
    title UX Priorities
    x-axis Low effort --> High effort
    y-axis Low impact --> High impact
    quadrant-1 Strategic bets
    quadrant-2 Quick wins
    quadrant-3 Revisit later
    quadrant-4 Costly distractions
    Markdown vault: [0.35, 0.85]
    Wiki health: [0.55, 0.75]`,
	mindMap: `mindmap
    root((Project))
        Design
            UI Mockups
            User Research
        Development
            Frontend
            Backend
        Testing
            Unit Tests
            Integration`,
	timeline: `timeline
    title Project Timeline
    section Phase 1
        Research : Gather requirements
        Design : Create mockups
    section Phase 2
        Develop : Build features
        Test : QA testing
    section Phase 3
        Launch : Go live
        Monitor : Track metrics`,
	sankey: `sankey-beta
    Sources,Wiki Pages,12
    Wiki Pages,Chat Answers,8
    Wiki Pages,Review Queue,4`,
	xyChart: `xychart-beta
    title "Knowledge Growth"
    x-axis [Jan, Feb, Mar, Apr]
    y-axis "Pages" 0 --> 100
    bar [12, 24, 48, 72]
    line [10, 30, 55, 90]`,
	blockDiagram: `block-beta
    columns 3
    Sources[Sources] Wiki[Wiki Pages] Chat[Chat]
    Sources --> Wiki
    Wiki --> Chat`,
	packet: `packet-beta
    title Network Packet
    0-15: "Source Port"
    16-31: "Destination Port"
    32-63: "Sequence Number"`,
	architecture: `architecture-beta
    group api(cloud)[API]
    service client(internet)[Client]
    service server(server)[Server] in api
    service db(database)[Database] in api
    client:R -- L:server
    server:B -- T:db`,
	radar: `radar-beta
    title Wiki Quality
    axis Coverage, Freshness, Accuracy, Links
    curve Current{70, 55, 85, 60}
    curve Target{90, 90, 95, 85}`,
	treemap: `treemap-beta
    "Knowledge Base"
        "Sources": 40
        "Wiki Pages": 35
        "Open Questions": 10
        "Review Queue": 15`,
	kanban: `kanban
    todo[Todo]
        id1[Import sources]
    doing[Doing]
        id2[Update wiki]
    done[Done]
        id3[Verify chat]`,
	ishikawa: `ishikawa
    title Missed Fact Root Cause
    Chat failure
        Retrieval
            Thin wiki context
        Prompting
            Missing raw details
        Validation
            No exact-fact score`,
	c4Context: `C4Context
    title System Context
    Person(user, "User")
    System(app, "Local Wiki")
    System_Ext(ollama, "Ollama")
    Rel(user, app, "Writes and queries markdown")
    Rel(app, ollama, "Asks local model")`,
};

export type DiagramTemplateKey = keyof typeof diagramTemplates;
