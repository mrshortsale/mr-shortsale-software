import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  AlertCircle, CheckCircle2, Clock, Loader2, Pencil, Plus, Search,
  ShieldCheck, Trash2, User, UserX, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminListUsers, adminListPendingUsers, adminCreateUser,
  adminUpdateUser, adminDeleteUser, adminApproveUser, adminRejectUser,
  type AdminUserRow,
} from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  '#042C53', '#0F6E56', '#185FA5', '#854F0B', '#7C3AED', '#B91C1C',
];

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ceo', 'rep'], { required_error: 'Role is required' }),
  avatarColor: z.string(),
  approveImmediately: z.boolean(),
});

const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ceo', 'rep']),
  avatarColor: z.string(),
  isActive: z.boolean(),
  password: z.string().optional(),
});

type CreateUserValues = z.infer<typeof createUserSchema>;
type EditUserValues = z.infer<typeof editUserSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function UserAvatar({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-bold text-white shrink-0`} style={{ backgroundColor: color }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RoleBadge({ role }: { role: 'ceo' | 'rep' }) {
  return role === 'ceo'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary"><ShieldCheck size={11} /> CEO</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary"><User size={11} /> Rep</span>;
}

function StatusBadge({ user }: { user: AdminUserRow }) {
  if (user.status === 'pending') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium"><Clock size={11} />Pending</span>;
  }
  if (user.status === 'rejected') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-destructive font-medium"><UserX size={11} />Rejected</span>;
  }
  return user.is_active
    ? <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
    : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />Inactive</span>;
}

function sortUsersByName(list: AdminUserRow[]): AdminUserRow[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-full border-2 transition-transform ${value === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

// ─── Create user dialog ───────────────────────────────────────────────────────

function CreateUserDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (user: AdminUserRow) => void;
}) {
  const [serverError, setServerError] = useState('');

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '', email: '', password: '', role: 'rep',
      avatarColor: COLOR_SWATCHES[2], approveImmediately: false,
    },
  });

  const onSubmit = async (values: CreateUserValues) => {
    setServerError('');
    const result = await adminCreateUser(values);
    if (result.error) { setServerError(result.error); return; }
    if (!result.user) { setServerError('Failed to create user'); return; }

    const approved = values.approveImmediately;
    toast.success(
      approved
        ? `${values.name} added and approved.`
        : `${values.name} added — pending approval.`
    );
    form.reset();
    onCreated(result.user);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setServerError(''); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>

        {serverError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />{serverError}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="jane@mrshortsale.net" type="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input placeholder="Min 8 characters" type="password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="rep">Sales Rep</SelectItem>
                    <SelectItem value="ceo">CEO</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="avatarColor" render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar Color</FormLabel>
                <FormControl>
                  <ColorPicker value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="approveImmediately" render={({ field }) => (
              <FormItem className="flex items-start gap-3 rounded-lg border p-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                </FormControl>
                <div>
                  <FormLabel className="mb-0 cursor-pointer">Approve immediately</FormLabel>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    If unchecked, account will be created as pending and must be approved separately.
                  </p>
                </div>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
                Add User
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit user dialog ─────────────────────────────────────────────────────────

function EditUserDialog({ user, open, onClose, onUpdated }: {
  user: AdminUserRow; open: boolean; onClose: () => void; onUpdated: (user: AdminUserRow) => void;
}) {
  const [serverError, setServerError] = useState('');

  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name, role: user.role, avatarColor: user.avatar_color,
      isActive: user.is_active, password: '',
    },
  });

  useEffect(() => {
    form.reset({
      name: user.name, role: user.role, avatarColor: user.avatar_color,
      isActive: user.is_active, password: '',
    });
  }, [user, form]);

  const onSubmit = async (values: EditUserValues) => {
    setServerError('');
    const result = await adminUpdateUser(user.id, {
      name: values.name, role: values.role, avatarColor: values.avatarColor,
      isActive: values.isActive, password: values.password || undefined,
    });
    if (result.error) { setServerError(result.error); return; }
    if (!result.user) { setServerError('Failed to update user'); return; }
    toast.success(`${values.name} updated.`);
    onUpdated(result.user);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setServerError(''); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        {serverError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />{serverError}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="rep">Sales Rep</SelectItem>
                    <SelectItem value="ceo">CEO</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="avatarColor" render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar Color</FormLabel>
                <FormControl>
                  <ColorPicker value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel className="mb-0">Account Active</FormLabel>
                  <p className="text-xs text-muted-foreground mt-0.5">Deactivated users cannot log in.</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>New Password <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                <FormControl><Input placeholder="Leave blank to keep current" type="password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pending users section ────────────────────────────────────────────────────

function PendingSection({
  onApproved,
  onRejected,
  refreshKey,
}: {
  onApproved: (user: AdminUserRow) => void;
  onRejected: () => void;
  /** Increment to reload pending list silently (e.g. after CEO creates pending user) */
  refreshKey?: number;
}) {
  const [pending, setPending] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminUserRow | null>(null);
  const hasLoadedOnce = useRef(false);

  const fetchPending = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFetchError('');
    const result = await adminListPendingUsers();
    if (result.error) setFetchError(result.error);
    else setPending(result.users ?? []);
    if (!silent) setLoading(false);
    hasLoadedOnce.current = true;
  }, []);

  useEffect(() => { fetchPending(false); }, [fetchPending]);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0 && hasLoadedOnce.current) {
      fetchPending(true);
    }
  }, [refreshKey, fetchPending]);

  const handleApprove = async (user: AdminUserRow) => {
    setActionId(user.id);
    const result = await adminApproveUser(user.id);
    setActionId(null);
    if (result.error) { toast.error(result.error); return; }
    if (!result.user) { toast.error('Failed to approve user'); return; }
    toast.success(`${user.name} approved.`);
    setPending((prev) => prev.filter((p) => p.id !== user.id));
    onApproved(result.user);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setActionId(target.id);
    const result = await adminRejectUser(target.id);
    setActionId(null);
    setRejectTarget(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`${target.name}'s request rejected.`);
    setPending((prev) => prev.filter((p) => p.id !== target.id));
    onRejected();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review signup requests from new reps. Approved users can sign in immediately.
      </p>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle size={15} className="shrink-0" />{fetchError}
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  <Loader2 size={20} className="animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : pending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                  No pending signup requests
                </TableCell>
              </TableRow>
            ) : pending.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <UserAvatar name={u.name} color={u.avatar_color} size="sm" />
                </TableCell>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(u.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                      disabled={actionId === u.id}
                      onClick={() => handleApprove(u)}
                    >
                      {actionId === u.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <CheckCircle2 size={12} />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/5"
                      disabled={actionId === u.id}
                      onClick={() => setRejectTarget(u)}
                    >
                      <XCircle size={12} />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejectTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their account will be marked as rejected. They will not be able to sign in and cannot
              re-register with the same email. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!!actionId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionId ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Reject Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'all' | 'pending';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFetchError('');
    const [mainResult, pendingResult] = await Promise.all([
      adminListUsers(),
      adminListPendingUsers(),
    ]);
    if (mainResult.error) setFetchError(mainResult.error);
    else setUsers(mainResult.users ?? []);
    setPendingCount(pendingResult.users?.length ?? 0);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(false); }, [fetchUsers]);

  const handleUserCreated = useCallback((user: AdminUserRow) => {
    if (user.status === 'pending') {
      setPendingCount((c) => c + 1);
      setPendingRefreshKey((k) => k + 1);
    } else {
      setUsers((prev) => sortUsersByName([...prev, user]));
    }
  }, []);

  const handleUserUpdated = useCallback((user: AdminUserRow) => {
    setUsers((prev) => sortUsersByName(prev.map((u) => (u.id === user.id ? user : u))));
  }, []);

  const handleUserApproved = useCallback((user: AdminUserRow) => {
    setPendingCount((c) => Math.max(0, c - 1));
    setUsers((prev) => sortUsersByName([...prev, user]));
  }, []);

  const handleUserRejected = useCallback(() => {
    setPendingCount((c) => Math.max(0, c - 1));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const removed = deleteTarget;
    setDeleting(true);
    const result = await adminDeleteUser(removed.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${removed.name} deleted.`);
      setUsers((prev) => prev.filter((u) => u.id !== removed.id));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage platform users and their roles.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
          <Plus size={15} /> Add User
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'all'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending approval
          {pendingCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Pending section */}
      {activeTab === 'pending' && (
        <PendingSection
          onApproved={handleUserApproved}
          onRejected={handleUserRejected}
          refreshKey={pendingRefreshKey}
        />
      )}

      {/* All users section */}
      {activeTab === 'all' && (
        <>
          {/* Search */}
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-8 h-9 text-sm"
            />
          </div>

          {fetchError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle size={15} className="shrink-0" />{fetchError}
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      <Loader2 size={20} className="animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <UserAvatar name={u.name} color={u.avatar_color} size="sm" />
                    </TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell><RoleBadge role={u.role} /></TableCell>
                    <TableCell><StatusBadge user={u} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(u)}>
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={u.id === currentUser?.id}
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Dialogs */}
      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleUserCreated}
      />

      {editTarget && (
        <EditUserDialog
          user={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={handleUserUpdated}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the user and all their data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
