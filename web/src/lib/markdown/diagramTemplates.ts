export const diagramTemplates = {
	flowchart: `graph TD
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
    Animal <|-- Cat

    style Animal fill:#f9e79f,stroke:#f1c40f,color:#333
    style Dog fill:#aed6f1,stroke:#3498db,color:#333
    style Cat fill:#d5f5e3,stroke:#2ecc71,color:#333`,
	decisionTree: `graph TD
    A{Is it raining?}:::orange
    A -->|Yes| B{Have umbrella?}:::orange
    A -->|No| C[Go outside]:::green
    B -->|Yes| D[Take umbrella]:::blue
    B -->|No| E[Stay inside]:::red
    D --> C

    classDef green fill:#2ecc71,stroke:#27ae60,color:#fff
    classDef blue fill:#3498db,stroke:#2980b9,color:#fff
    classDef orange fill:#f39c12,stroke:#e67e22,color:#fff
    classDef red fill:#e74c3c,stroke:#c0392b,color:#fff`,
	mindMap: `%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#4a7c6f','primaryTextColor':'#fff','primaryBorderColor':'#3d6b5e','secondaryColor':'#5b7fa5','secondaryTextColor':'#fff','secondaryBorderColor':'#4a6e94','tertiaryColor':'#8b6e99','tertiaryTextColor':'#fff','tertiaryBorderColor':'#7a5d88'}}}%%
mindmap
    root((Project))
        ::icon(fa fa-pencil)
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
        Monitor : Track metrics`
};
