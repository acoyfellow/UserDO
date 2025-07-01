# Organizations Example

A complete **team project management system** built with UserDO, demonstrating organization-scoped data, member management, and multi-level business logic.

## What This Example Demonstrates

This is a **full-featured team collaboration app** that shows how UserDO's built-in organization features enable complex multi-user applications with minimal code.

### Core Features

- **🏢 Organizations**: Create and manage teams/companies
- **📋 Projects**: Organization-scoped project management  
- **✅ Tasks**: Project-specific task tracking with assignments
- **👥 Member Management**: Invite users, assign roles (Owner/Admin/Member)
- **🔐 Access Control**: Automatic permission checking across all levels
- **📡 Real-time Updates**: Live collaboration via WebSocket

### Architecture Overview

```
Users
  ↓
Organizations (Owner/Admin/Member roles)
  ↓  
Projects (organization-scoped)
  ↓
Tasks (project-scoped, assignable to members)
```

## Key UserDO Features Showcased

### 1. **Built-in Organization Management**
```ts
// Zero custom code needed for organization CRUD
await teamDO.createOrganization(name);
await teamDO.getOrganizations(); // Returns owned + member orgs
await teamDO.addOrganizationMember(orgId, email, role);
```

### 2. **Organization-Scoped Data Tables**
```ts
export class TeamDO extends UserDO {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    
    // Data automatically isolated per organization
    this.projects = this.table('projects', ProjectSchema, { organizationScoped: true });
    this.tasks = this.table('tasks', TaskSchema, { organizationScoped: true });
  }
}
```

### 3. **Automatic Context Switching**
```ts
async createProject(name: string, description: string, organizationId: string) {
  await this.getOrganization(organizationId); // Built-in access control
  this.setOrganizationContext(organizationId); // Switch data scope
  return await this.projects.create({ name, description }); // Auto-scoped
}
```

### 4. **Cross-User Invitations**
```ts
// Automatically stores invitation in target user's UserDO
await teamDO.addOrganizationMember(orgId, 'newuser@example.com', 'member');

// Target user sees invitation immediately when they log in
const { memberOrganizations } = await userDO.getOrganizations();
```

## Complete Web Interface

### Pages Included:
- **Dashboard**: Overview of owned/member organizations
- **Organization Detail**: Projects list, member management
- **Project Detail**: Tasks list, assignment management  
- **Create Forms**: New organizations, projects, tasks
- **Member Management**: Add/remove users, role assignment

### API Endpoints:
- **Built-in Org Endpoints**: `/api/organizations/*` (from UserDO)
- **Project Endpoints**: `/api/projects` (custom business logic)
- **Task Endpoints**: `/api/tasks` (custom business logic)
- **Web Routes**: Full navigation between all pages

## Code Structure

```
index.tsx (438 lines)
├── TeamDO class (60 lines) - Pure business logic
├── API endpoints (80 lines) - Project/task operations  
├── Web routes (200 lines) - Full navigation
└── Worker export (10 lines) - WebSocket + HTTP

frontend.tsx (506 lines)
├── 9 complete page components
├── Forms with validation
├── Role-based UI rendering
└── Navigation and styling
```

## Running the Example

```bash
# From repository root
cd examples/organizations
bun install
bun run dev
```

Visit `http://localhost:8787` and:

1. **Sign up** as first user (becomes org owner)
2. **Create organization** "My Company"  
3. **Add members** with different roles
4. **Create projects** within the organization
5. **Create tasks** within projects, assign to members
6. **Switch users** to see role-based access control

## What Makes This "Clean"

### Before UserDO (Complex):
- 300+ lines of custom organization logic
- Manual invitation storage/retrieval
- Complex cross-user data access
- Custom access control implementation
- Manual context switching

### With UserDO (Clean):
- **60 lines** of pure business logic in TeamDO
- **Zero** custom organization code needed
- **Automatic** invitation delivery
- **Built-in** access control
- **Automatic** data scoping

## Key Learning Points

1. **Organization features are built-in** - No custom implementation needed
2. **Data scoping is automatic** - Just use `{ organizationScoped: true }`
3. **Member management works across users** - Invitations are delivered automatically
4. **Access control is handled** - `getOrganization()` validates permissions
5. **Business logic stays pure** - Focus on projects/tasks, not org complexity

## Production Considerations

- **Scalability**: Each user gets their own Durable Object instance
- **Security**: Built-in role-based access control and data isolation  
- **Real-time**: WebSocket broadcasts for live collaboration
- **Type Safety**: Full TypeScript with Zod validation
- **Error Handling**: Graceful failures with user-friendly messages

This example proves that **complex multi-user applications** can be built with **minimal code** when the platform handles the hard parts for you. 