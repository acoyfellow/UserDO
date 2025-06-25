# 🎉 Clean Organizations Example

This example demonstrates how **dramatically simpler** organization management becomes with my UserDO's built-in organization features.

## 📊 Code Comparison

| Aspect | Complex Example (Original) | Clean Example (My UserDO) |
|--------|---------------------------|---------------------------|
| **Lines of Code** | ~940 lines | ~400 lines |
| **TeamDO Class** | 320+ lines with complex logic | 60 lines of pure business logic |
| **Organization Logic** | Custom implementation required | Built-in, just works |
| **Invitation System** | Manual complex implementation | Automatic with `addMemberToOrganization()` |
| **Member Management** | Custom storage + retrieval logic | Built-in `getMemberOrganizations()` |
| **Data Isolation** | Manual context switching | Automatic with `setOrganizationContext()` |
| **Error Handling** | Extensive debugging code | Clean, built-in error handling |

## 🚀 What My UserDO Eliminates

### ❌ Complex Custom Logic You Had to Write:
```ts
// Your complex invitation storage logic
async addMemberToOrganization({ organizationId, email, role }) {
  // Call parent method first
  const result = await super.addMemberToOrganization({ organizationId, email, role });
  
  // Then manually handle invitation storage with complex debugging
  try {
    const hashedEmail = await import('userdo').hashEmailForId(email.toLowerCase());
    const namespace = (this.env as Env).TEAM_DO;
    const userDOID = namespace.idFromName(email.toLowerCase()); // BUG: should use hashed!
    const inviteeDO = namespace.get(userDOID) as TeamDO;
    
    await inviteeDO.storeInvitation({
      organizationId,
      organizationName: organization.name,
      inviterEmail: user.email,
      role,
      addedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('TeamDO: Error storing invitation:', error);
  }
}

// Custom invitation storage you had to implement
async storeInvitation(invitation) {
  console.log('TeamDO: Storing invitation:', invitation);
  const key = `invitation:${invitation.organizationId}`;
  await this.storage.put(key, invitation);
  
  // Extensive debugging...
  const stored = await this.storage.get(key);
  console.log('TeamDO: Verification - stored data:', stored);
  const allKeys = await this.storage.list();
  console.log('TeamDO: All storage keys after storing:', Array.from(allKeys.keys()));
}

// Custom retrieval logic
async getMemberOrganizations() {
  const memberOrganizations: any[] = [];
  const invitationKeys = await this.storage.list({ prefix: 'invitation:' });
  
  for (const [key, value] of invitationKeys) {
    const invitation = value as any;
    memberOrganizations.push({
      organizationId: invitation.organizationId,
      organizationName: invitation.organizationName,
      role: invitation.role,
      addedAt: invitation.addedAt,
    });
  }
  
  return { organizations: memberOrganizations };
}
```

### ✅ My UserDO Makes This Simple:
```ts
// No overrides needed - it just works!
export class TeamDO extends UserDO {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    
    // Organization-scoped tables - automatic data isolation
    this.projects = this.table('projects', ProjectSchema, { organizationScoped: true });
    this.tasks = this.table('tasks', TaskSchema, { organizationScoped: true });
  }

  // Pure business logic - no organization complexity
  async createProject(name: string, description: string, organizationId: string) {
    await this.getOrganization({ organizationId }); // Built-in access control
    this.setOrganizationContext(organizationId);     // Built-in context
    return await this.projects.create({ name, description, status: 'active', createdAt: new Date().toISOString() });
  }
}

// Built-in methods that just work:
// ✅ await teamDO.addMemberToOrganization({ organizationId, email, role })
//    ↳ Automatically stores invitation in target user's DO
// ✅ await teamDO.getMemberOrganizations()
//    ↳ Returns all stored invitations/memberships
// ✅ await teamDO.getOrganization({ organizationId })
//    ↳ Built-in access control and invitation handling
```

## 🏗️ Built-In Organization Features

My UserDO includes all organization functionality out of the box:

### 🎯 **Organization Management**
- `createOrganization(name)` - Create new organization
- `getOrganizations()` - Get user's owned organizations  
- `getOrganization({ organizationId })` - Get specific org with access control

### 👥 **Member Management** 
- `addMemberToOrganization({ organizationId, email, role })` - **Automatically stores invitation**
- `removeMemberFromOrganization({ organizationId, email })` - Clean member removal
- `getMemberOrganizations()` - **Automatically returns stored invitations**
- `updateMemberRole({ organizationId, email, role })` - Role management

### 🔐 **Built-In Security**
- Automatic access control verification
- Role-based permissions (owner/admin/member)
- Email hashing for privacy
- Invitation validation

### 📊 **Organization-Scoped Data**
- `{ organizationScoped: true }` table option
- `setOrganizationContext(organizationId)` for data isolation
- Automatic SQL scoping by organization
- Zero manual context management

## 🚦 Usage Pattern

```ts
// 1. Create your business logic DO
export class MyAppDO extends UserDO {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.businessData = this.table('business_data', Schema, { organizationScoped: true });
  }

  async doBusinessLogic(organizationId: string, data: any) {
    this.setOrganizationContext(organizationId); // Set context
    return await this.businessData.create(data); // Automatically scoped
  }
}

// 2. Use built-in worker with organization endpoints
const app = createUserDOWorker('MY_APP_DO');

// 3. Organization endpoints work automatically:
//    POST /api/organizations - Create organization
//    GET /api/organizations - Get owned organizations  
//    GET /api/organizations/member - Get member organizations
//    POST /api/organizations/members - Add member (with auto-invitation)
//    DELETE /api/organizations/members - Remove member

// 4. Add your business endpoints
app.post('/api/business-action', async (c) => {
  const { organizationId, data } = await c.req.json();
  const myAppDO = await getUserDOFromContext(c, user.email, 'MY_APP_DO') as MyAppDO;
  return c.json(await myAppDO.doBusinessLogic(organizationId, data));
});
```

## 🎯 Key Benefits

1. **🧹 Clean Separation**: Organization logic is built-in, business logic stays pure
2. **🔧 Zero Setup**: No complex custom implementation needed  
3. **🛡️ Secure by Default**: Built-in access control and validation
4. **📡 Real-time Ready**: WebSocket broadcasts included
5. **🚀 Production Ready**: Error handling, rate limiting, type safety included
6. **🔄 Backward Compatible**: Existing UserDO code still works

## 📋 Setup Instructions

```bash
# 1. Link UserDO (from repository root)
cd /srv/userdo  
bun link

# 2. In this example directory
cd examples/clean-organizations
bun link userdo
bun install

# 3. Run the example
bun run dev
```

## 🎉 The Result

What took **940 lines** of complex custom logic now takes **~400 lines** of clean business logic. 

Your TeamDO went from a complex organization management system to a simple business logic class, because all the organization complexity is now built into UserDO itself.

**This is the power of proper abstraction!** 🚀