import { z } from 'zod';
import { UserDO, getUserDO } from '../src/UserDO';

// Example schemas for demonstration
const TaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  completed: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
});

type Task = z.infer<typeof TaskSchema>;
type Project = z.infer<typeof ProjectSchema>;

/**
 * Organization Demo: Shows how to use UserDO with organization-scoped data
 * 
 * Key Features:
 * - Personal data (user-scoped) works as before
 * - Organization data (organization-scoped) requires context switching
 * - Same API, different scoping based on table options
 */
export class OrganizationDemo {
  private userDO: UserDO;

  // Personal tables (user-scoped)
  private personalTasks: any;
  private personalProjects: any;

  // Organization tables (organization-scoped)
  private orgTasks: any;
  private orgProjects: any;

  constructor(userDO: UserDO) {
    this.userDO = userDO;

    // Personal data - works exactly as before
    this.personalTasks = this.userDO.table('personal_tasks', TaskSchema, { userScoped: true });
    this.personalProjects = this.userDO.table('personal_projects', ProjectSchema, { userScoped: true });

    // Organization data - requires organization context
    this.orgTasks = this.userDO.table('team_tasks', TaskSchema, { organizationScoped: true });
    this.orgProjects = this.userDO.table('team_projects', ProjectSchema, { organizationScoped: true });
  }

  // === Personal Data Management (unchanged from before) ===

  async createPersonalTask(task: Omit<Task, 'completed'>) {
    // No organization context needed - works as before
    return await this.personalTasks.create(task);
  }

  async getPersonalTasks() {
    return await this.personalTasks.getAll();
  }

  async createPersonalProject(project: Omit<Project, 'status'>) {
    return await this.personalProjects.create(project);
  }

  async getPersonalProjects() {
    return await this.personalProjects.getAll();
  }

  // === Organization Data Management (new functionality) ===

  async createOrganizationTask(organizationId: string, task: Omit<Task, 'completed'>) {
    // Set organization context
    this.userDO.setOrganizationContext(organizationId);

    // Create task in organization scope
    const result = await this.orgTasks.create(task);

    // Clear context (optional - can stay set for multiple operations)
    this.userDO.setOrganizationContext();

    return result;
  }

  async getOrganizationTasks(organizationId: string) {
    this.userDO.setOrganizationContext(organizationId);
    const tasks = await this.orgTasks.getAll();
    this.userDO.setOrganizationContext(); // Clear context
    return tasks;
  }

  async createOrganizationProject(organizationId: string, project: Omit<Project, 'status'>) {
    this.userDO.setOrganizationContext(organizationId);
    const result = await this.orgProjects.create(project);
    this.userDO.setOrganizationContext();
    return result;
  }

  async getOrganizationProjects(organizationId: string) {
    this.userDO.setOrganizationContext(organizationId);
    const projects = await this.orgProjects.getAll();
    this.userDO.setOrganizationContext();
    return projects;
  }

  // === Bulk Operations Example ===

  async workWithOrganization(organizationId: string) {
    // Set context once for multiple operations
    this.userDO.setOrganizationContext(organizationId);

    // All operations now work within this organization
    const tasks = await this.orgTasks.getAll();
    const projects = await this.orgProjects.getAll();

    // Create some sample data
    const newTask = await this.orgTasks.create({
      title: 'Team Sprint Planning',
      description: 'Plan the next sprint with the team',
      priority: 'high'
    });

    const newProject = await this.orgProjects.create({
      name: 'Q4 Initiative',
      description: 'Major project for Q4 goals'
    });

    // Clear context when done
    this.userDO.setOrganizationContext();

    return { tasks, projects, newTask, newProject };
  }

  // === Complete Workflow Example ===

  async completeWorkflow() {
    console.log('=== Organization Demo Workflow ===\n');

    // 1. Create an organization
    console.log('1. Creating organization...');
    const { organization } = await this.userDO.createOrganization('Demo Corp');
    console.log(`Created: ${organization.name} (${organization.id})\n`);

    // 2. Work with personal data (unchanged)
    console.log('2. Creating personal data...');
    const personalTask = await this.createPersonalTask({
      title: 'Personal Todo',
      description: 'Something just for me'
    });
    console.log(`Personal task: ${personalTask.title}\n`);

    // 3. Work with organization data
    console.log('3. Creating organization data...');
    const orgTask = await this.createOrganizationTask(organization.id, {
      title: 'Team Meeting',
      description: 'Weekly team sync'
    });
    console.log(`Organization task: ${orgTask.title}\n`);

    // 4. Show data separation
    console.log('4. Data separation demonstration:');
    const personalTasks = await this.getPersonalTasks();
    const orgTasks = await this.getOrganizationTasks(organization.id);

    console.log(`Personal tasks: ${personalTasks.length}`);
    console.log(`Organization tasks: ${orgTasks.length}`);
    console.log('Data is completely separate!\n');

    // 5. Add team members
    console.log('5. Adding team members...');
    const { member } = await this.userDO.addOrganizationMember(
      organization.id,
      'teammate@example.com',
      'admin'
    );
    console.log(`Added member: ${member.email} as ${member.role}\n`);

    // 6. Get organization overview
    console.log('6. Organization overview:');
    const { organizations, memberOrganizations } = await this.userDO.getOrganizations();
    console.log(`Organizations I own: ${organizations.length}`);
    console.log(`Organizations I'm a member of: ${memberOrganizations.length}\n`);

    return {
      organization,
      personalTask,
      orgTask,
      personalTasks,
      orgTasks,
      member
    };
  }
}

// === Usage Examples ===

export async function runOrganizationDemo(userDO: UserDO) {
  const demo = new OrganizationDemo(userDO);
  return await demo.completeWorkflow();
}

// Example of how to use in your application
export async function exampleUsage(env: any, userEmail: string) {
  // Get the user's DO
  const userDO = await getUserDO(env.USERDO, userEmail);

  // Run the demo
  const results = await runOrganizationDemo(userDO);

  console.log('Demo completed successfully!');
  return results;
}

// === Key Benefits Demonstrated ===

/*
1. **No Breaking Changes**: All existing auth and personal data APIs work unchanged
2. **Simple Extension**: Just add `organizationScoped: true` to table options
3. **Context Switching**: Use `setOrganizationContext()` to switch between scopes
4. **Data Separation**: Personal and organization data are completely isolated
5. **Same API**: Whether personal or organization-scoped, the table API is identical
6. **Flexible**: Can work with multiple organizations by switching context
*/ 