# Organizations Example

A team project management system demonstrating UserDO's organization features for building multi-user applications.

## What You'll Learn

- How to use UserDO's built-in organization management
- Organization-scoped data tables and automatic context switching
- Cross-user member invitations and role management
- Building a complete web interface with forms and navigation
- Real-time collaboration with WebSocket integration

## Application Features

- Create and manage organizations (teams/companies)
- Add members with different roles (Owner/Admin/Member)
- Create projects within organizations
- Manage tasks within projects with member assignments
- Role-based access control throughout the application
- Real-time updates for collaborative work

## Architecture

```
Users
  ↓
Organizations (Owner/Admin/Member roles)
  ↓  
Projects (organization-scoped)
  ↓
Tasks (project-scoped, assignable to members)
```

## Key Implementation Patterns

### Organization-Scoped Data Tables

```ts
export class TeamDO extends UserDO {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    
    // Tables automatically isolated per organization
    this.projects = this.table('projects', ProjectSchema, { organizationScoped: true });
    this.tasks = this.table('tasks', TaskSchema, { organizationScoped: true });
  }
}
```

### Context Switching for Data Isolation

```ts
async createProject(name: string, description: string, organizationId: string) {
  await this.getOrganization(organizationId); // Access control check
  this.setOrganizationContext(organizationId); // Switch data scope
  return await this.projects.create({ name, description }); // Auto-scoped to org
}
```

### Built-in Member Management

```ts
// Add member - automatically handles cross-user invitations
await teamDO.addOrganizationMember(orgId, 'user@example.com', 'admin');

// Get organizations - returns both owned and member organizations
const { ownedOrganizations, memberOrganizations } = await teamDO.getOrganizations();
```

## File Structure

```
index.tsx - Main application with TeamDO class and API routes
frontend.tsx - React components for all pages
package.json - Dependencies and scripts
wrangler.jsonc - Cloudflare Workers configuration
```

## Running the Example

```bash
cd examples/organizations
bun install
bun run dev
```

Open `http://localhost:8787` and:

1. Sign up as the first user (automatically becomes organization owner)
2. Create an organization
3. Add other users as members with different roles
4. Create projects and tasks
5. Log in as different users to see role-based access

## API Endpoints

### Built-in Organization Endpoints (from UserDO)
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - Get user's organizations
- `GET /api/organizations/:id` - Get specific organization
- `POST /api/organizations/:id/members` - Add member
- `DELETE /api/organizations/:id/members/:userId` - Remove member

### Custom Business Logic Endpoints
- `POST /api/projects` - Create project in organization
- `GET /api/projects` - Get organization's projects
- `POST /api/tasks` - Create task in project
- `PUT /api/tasks/:id` - Update task status/assignment

## Web Interface

The example includes a complete web interface with:

- Dashboard showing owned and member organizations
- Organization detail pages with project listings
- Project detail pages with task management
- Forms for creating organizations, projects, and tasks
- Member management interface with role assignment
- Navigation between all sections

## Learning Points

1. **Organization features work out of the box** - No custom implementation needed for basic org management
2. **Data scoping is automatic** - Use `{ organizationScoped: true }` and `setOrganizationContext()`
3. **Member invitations work across users** - UserDO handles storing invitations in target user accounts
4. **Access control is built-in** - `getOrganization()` validates user permissions automatically
5. **Focus on business logic** - Spend time on projects/tasks, not organization infrastructure

## Extending This Example

To adapt this for your use case:

1. Replace the `projects` and `tasks` tables with your business entities
2. Update the schemas to match your data requirements  
3. Modify the web interface to match your application flow
4. Add any additional business logic methods to your UserDO subclass
5. Keep the organization management as-is - it handles the multi-user complexity

This example shows how UserDO's organization features let you build complex multi-user applications by focusing on your business logic rather than user management infrastructure.