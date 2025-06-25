# Organizations Example

This example demonstrates how to use UserDO's organization features to build a multi-tenant application where users can create organizations and manage team members.

## Features Demonstrated

- Creating organizations
- Adding/removing members
- Role-based permissions (owner, admin, member)
- Organization-scoped data storage
- Real-time updates for organization changes

## Setup

### Important: Link UserDO First

This example uses the local UserDO package. You **must** link it before running:

```bash
# 1. From the repository root, link UserDO globally
cd /srv/userdo
bun link

# 2. In this example directory, link UserDO and install
cd examples/organizations
bun link userdo
bun install

# 3. Run the example
bun run dev
```

### Why This Is Necessary

- Uses `"userdo": "link:userdo"` in package.json to avoid bun install hanging
- Ensures you're using the latest local UserDO code with organization features
- Provides proper TypeScript resolution

## Usage

### 1. Create an Organization

```ts
import { UserDOClient } from 'userdo';

const client = new UserDOClient('/api');

// First, authenticate
await client.login('owner@example.com', 'password');

// Create an organization
const { organization } = await client.createOrganization('My Company');
console.log('Created organization:', organization);
```

### 2. Manage Members

```ts
// Add a member to the organization
await client.addMemberToOrganization(
  organization.id, 
  'member@example.com', 
  'admin'
);

// Update member role
await client.updateMemberRole(
  organization.id, 
  'member@example.com', 
  'member'
);

// Remove member
await client.removeMemberFromOrganization(
  organization.id, 
  'member@example.com'
);
```

### 3. Organization-Scoped Data

```ts
// In your UserDO class
export class TeamDO extends UserDO {
  projects: Table<Project>;
  
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    // Organization-scoped projects
    this.projects = this.table('projects', ProjectSchema, { 
      organizationScoped: true 
    });
  }
  
  async createProject(name: string, organizationId: string) {
    // Set organization context
    this.setOrganizationContext(organizationId);
    
    // Create project - will be scoped to the organization
    return await this.projects.create({
      name,
      createdAt: new Date().toISOString(),
    });
  }
  
  async getProjects(organizationId: string) {
    // Set organization context
    this.setOrganizationContext(organizationId);
    
    // Get projects - only returns projects for this organization
    return await this.projects.orderBy('createdAt', 'desc').get();
  }
}
```

## Key Concepts

### Organization Hierarchy
```
User (owner@example.com)
├── Organization: "My Company" (owner)
│   ├── Member: member1@example.com (admin)
│   ├── Member: member2@example.com (member)
│   └── Data: Projects, Tasks, etc.
└── Organization: "Side Project" (owner)
    ├── Member: freelancer@example.com (member)
    └── Data: Different set of projects
```

### Permission Model
- **Owner**: Full control over organization and members
- **Admin**: Can manage members and organization data
- **Member**: Can access organization data (read/write based on your implementation)

### Data Isolation
- Each organization has completely isolated data
- Members can only access data from organizations they belong to
- User-scoped data remains private to each user
- Organization-scoped data is shared among organization members

## Real-time Updates

Organization changes are automatically broadcast via WebSocket:

```ts
// Listen for organization changes
client.onChange('organization:created', (org) => {
  console.log('New organization created:', org);
});

client.onChange('organization:member_added', (data) => {
  console.log('Member added:', data);
});

client.onChange('organization:member_removed', (data) => {
  console.log('Member removed:', data);
});
```

## Security Considerations

1. **Access Control**: Always verify organization membership before allowing operations
2. **Role Permissions**: Implement role-based access control in your business logic
3. **Data Validation**: Validate organization IDs and user permissions on every request
4. **Audit Trail**: Consider logging organization changes for compliance

## Example Implementation

See `index.ts` for a complete example showing:
- Organization management endpoints
- Member role validation
- Organization-scoped data operations
- Real-time updates for team collaboration 