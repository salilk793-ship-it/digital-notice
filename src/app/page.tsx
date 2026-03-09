'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  FileText,
  Settings,
  User,
  Users,
  Bell,
  Clock,
  Calendar,
  Trash2,
  Edit,
  Plus,
  LogOut,
  Moon,
  Sun,
  Search,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  LayoutDashboard,
  FolderArchive,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Eye,
  Heart,
  ThumbsUp,
  CalendarDays,
  Filter,
  SortAsc,
  SortDesc,
  Sparkles,
  Send,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  ChevronDown,
  Bookmark,
  Pin,
  MessageCircle,
  Activity,
  History,
  Lock,
  FileDown,
  Download,
  RefreshCw,
  Image,
  Paperclip,
  Phone,
} from 'lucide-react';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useSync } from '@/hooks/use-sync';
import SyncStatus from '@/components/SyncStatus';

// Types
interface User {
  id: string;
  userId: string;
  name: string;
  role: 'admin' | 'member';
}

interface Notice {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  isPinned: boolean;
  startDate: Date;
  expiryDate: Date;
  status: string;
  publishedById?: string;
  publishedBy?: { userId: string; name: string } | null;
  createdAt: Date;
  isEdited: boolean;
  editedAt?: Date;
  viewCount: number;
  helpfulCount: number;
  likeCount: number;
  commentCount: number;
  // New optional fields
  image?: string | null;
  attachment?: string | null;
  attachmentName?: string | null;
  contact?: string | null;
}

interface Comment {
  id: string;
  noticeId: string;
  content: string;
  userId?: string;
  user?: { userId: string; name: string } | null;
  createdAt: Date;
  replies?: Comment[];
}

interface BookmarkData {
  id: string;
  noticeId: string;
  notice?: Notice;
  createdAt: Date;
}

interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  user?: { userId: string; name: string } | null;
  notice?: { id: string; title: string } | null;
  details?: string;
  createdAt: Date;
}

interface Request {
  id: string;
  title: string;
  description: string;
  category: string;
  requestedBy: string;
  createdAt: Date;
}

interface Feedback {
  id: string;
  name: string;
  email?: string;
  subject: string;
  message: string;
  type: string;
  status: string;
  createdAt: Date;
}

interface Analytics {
  overview: {
    totalNotices: number;
    activeNotices: number;
    expiredNotices: number;
    scheduledNotices: number;
    totalViews: number;
    totalReactions: number;
    totalRequests: number;
    pendingRequests: number;
    totalFeedbacks: number;
    pendingFeedbacks: number;
    userCount: number;
  };
  weekly: {
    newNotices: number;
    views: number;
    requests: number;
    feedbacks: number;
  };
  monthly: {
    newNotices: number;
    views: number;
    requests: number;
  };
  mostViewed: Array<{
    id: string;
    title: string;
    viewCount: number;
    category: string;
    createdAt: string;
  }>;
  noticesByCategory: Array<{ category: string; count: number }>;
  noticesByDate: Record<string, number>;
  viewsByDate: Record<string, number>;
  topPublishers: Array<{ name: string; count: number }>;
  trending: Array<{
    id: string;
    title: string;
    category: string;
    viewCount: number;
    weeklyViews: number;
  }>;
}

export default function NoticeBoardApp() {
  const { toast } = useToast();
  
  // State
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Notices state
  const [notices, setNotices] = useState<Notice[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [expiredNotices, setExpiredNotices] = useState<Notice[]>([]);
  const [deletedNotices, setDeletedNotices] = useState<Notice[]>([]);
  const [scheduledNotices, setScheduledNotices] = useState<Notice[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [reports, setReports] = useState<Array<{ name: string; size: number; createdAt: string; path: string }>>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentSection, setCurrentSection] = useState('dashboard');
  
  // Modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedNoticeForComments, setSelectedNoticeForComments] = useState<Notice | null>(null);
  
  // Form state
  const [loginForm, setLoginForm] = useState({ userId: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ userId: '', password: '', confirmPassword: '', name: '' });
  const [noticeForm, setNoticeForm] = useState({
    id: '',
    title: '',
    description: '',
    category: 'general',
    priority: 'normal',
    startDate: '',
    startTime: '',
    expiryDate: '',
    expiryTime: '',
    isScheduled: false,
    // New optional fields
    image: '',
    attachment: '',
    attachmentName: '',
    contact: '',
  });
  const [requestForm, setRequestForm] = useState({
    requestedBy: '',
    title: '',
    description: '',
    category: 'general',
  });
  const [feedbackForm, setFeedbackForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    type: 'suggestion',
  });
  const [commentForm, setCommentForm] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [registerRole, setRegisterRole] = useState<'admin' | 'member'>('member');
  
  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // View tracking
  const viewedNotices = useRef<Set<string>>(new Set());

  // ── Real-time sync ────────────────────────────────────────────────────────
  // Memoised refresh callbacks so useSync handler references stay stable
  const refreshNotices = useCallback(() => {
    fetchNotices();
    fetchAllNotices();
    fetchExpiredNotices();
    fetchDeletedNotices();
    fetchScheduledNotices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, categoryFilter, sortBy, sortOrder]);

  const refreshRequests = useCallback(() => { fetchRequests(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const refreshBookmarks = useCallback(() => { fetchBookmarks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const refreshAnalytics = useCallback(() => {
    if (user?.role === 'admin') fetchAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Only enable sync for authenticated (non-guest) users
  const isGuest = user?.id === 'guest' || user?.userId === 'Guest'
  const { status: syncStatus } = useSync({
    enabled: !!user && !isGuest,
    handlers: {
      notices:   () => refreshNotices(),
      reactions: () => refreshNotices(),
      comments:  () => {
        refreshNotices();
        if (selectedNoticeForComments) fetchComments(selectedNoticeForComments.id);
      },
      bookmarks: () => refreshBookmarks(),
      requests:  () => refreshRequests(),
      analytics: () => refreshAnalytics(),
      activity:  () => { if (user?.role === 'admin') fetchActivityLogs(); },
    },
  });

  // Fetch current user on mount
  useEffect(() => {
    fetchUser();
  }, []);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Fetch data when user changes
  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  // Search and filter effect
  useEffect(() => {
    if (user) {
      fetchNotices();
      fetchAllNotices();
    }
  }, [searchQuery, categoryFilter, sortBy, sortOrder]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setShowLanding(false);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllData = async () => {
    await Promise.all([
      fetchNotices(),
      fetchAllNotices(),
      fetchExpiredNotices(),
      fetchDeletedNotices(),
      fetchScheduledNotices(),
      fetchRequests(),
      fetchFeedbacks(),
      fetchBookmarks(),
      user?.role === 'admin' ? fetchAnalytics() : null,
      user?.role === 'admin' ? fetchActivityLogs() : null,
      user?.role === 'admin' ? fetchReports() : null,
    ]);
  };

  const fetchNotices = async () => {
    try {
      const res = await fetch(`/api/notices?status=active&category=${categoryFilter}&search=${searchQuery}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
      const data = await res.json();
      setNotices(data.notices || []);
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    }
  };

  const fetchAllNotices = async () => {
    try {
      const res = await fetch(`/api/notices?status=all&sortBy=${sortBy}&sortOrder=${sortOrder}`);
      const data = await res.json();
      setAllNotices(data.notices || []);
    } catch (error) {
      console.error('Failed to fetch all notices:', error);
    }
  };

  const fetchExpiredNotices = async () => {
    try {
      const res = await fetch('/api/notices?status=expired');
      const data = await res.json();
      setExpiredNotices(data.notices || []);
    } catch (error) {
      console.error('Failed to fetch expired notices:', error);
    }
  };

  const fetchDeletedNotices = async () => {
    try {
      const res = await fetch('/api/notices?status=deleted');
      const data = await res.json();
      setDeletedNotices(data.notices || []);
    } catch (error) {
      console.error('Failed to fetch deleted notices:', error);
    }
  };

  const fetchScheduledNotices = async () => {
    try {
      const res = await fetch('/api/notices?status=scheduled');
      const data = await res.json();
      setScheduledNotices(data.notices || []);
    } catch (error) {
      console.error('Failed to fetch scheduled notices:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const res = await fetch('/api/feedback');
      const data = await res.json();
      setFeedbacks(data.feedbacks || []);
    } catch (error) {
      console.error('Failed to fetch feedbacks:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/api/bookmarks');
      const data = await res.json();
      setBookmarks(data.bookmarks || []);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const res = await fetch('/api/activity');
      const data = await res.json();
      setActivityLogs(data.activities || []);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportType: 'full' }) });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Report Generated', description: `Report saved to: ${data.savedPath}` });
        await fetchReports();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to generate report', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const fetchComments = async (noticeId: string) => {
    try {
      const res = await fetch(`/api/comments?noticeId=${noticeId}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  // Toggle bookmark
  const toggleBookmark = async (noticeId: string) => {
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchBookmarks();
        toast({ 
          title: data.isBookmarked ? 'Bookmarked' : 'Removed', 
          description: data.isBookmarked ? 'Notice added to bookmarks' : 'Notice removed from bookmarks' 
        });
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  // Toggle pin
  const togglePin = async (noticeId: string, isPinned: boolean) => {
    try {
      const res = await fetch(`/api/notices/${noticeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
        toast({ 
          title: isPinned ? 'Pinned' : 'Unpinned', 
          description: isPinned ? 'Notice pinned to top' : 'Notice unpinned' 
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  // Submit comment
  const handleSubmitComment = async () => {
    if (!selectedNoticeForComments || !commentForm.trim()) return;
    
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          noticeId: selectedNoticeForComments.id, 
          content: commentForm 
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCommentForm('');
        fetchComments(selectedNoticeForComments.id);
        fetchAllData();
        toast({ title: 'Comment Added', description: 'Your comment has been posted' });
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    }
  };

  // Open comments modal
  const openCommentsModal = (notice: Notice) => {
    setSelectedNoticeForComments(notice);
    fetchComments(notice.id);
    setShowCommentsModal(true);
  };

  // Track view
  const trackView = async (noticeId: string) => {
    if (viewedNotices.current.has(noticeId)) return;
    viewedNotices.current.add(noticeId);
    
    try {
      await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId }),
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  // Reaction toggle
  const toggleReaction = async (noticeId: string, type: 'helpful' | 'like') => {
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId, type }),
      });
      const data = await res.json();
      if (data.success) {
        fetchNotices();
        fetchAllNotices();
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  // Auth handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setShowLoginModal(false);
        setShowLanding(false);
        setLoginForm({ userId: '', password: '' });
        toast({ title: 'Welcome!', description: 'Login successful' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to login', variant: 'destructive' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: registerForm.userId,
          password: registerForm.password,
          name: registerForm.name,
          role: registerRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRegisterModal(false);
        setShowLoginModal(true);
        setRegisterForm({ userId: '', password: '', confirmPassword: '', name: '' });
        toast({ title: 'Success', description: 'Registration successful! Please login.' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to register', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setShowLanding(true);
      toast({ title: 'Logged out', description: 'See you soon!' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to logout', variant: 'destructive' });
    }
  };

  const enterAsGuest = () => {
    setUser({ id: 'guest', userId: 'Guest', name: 'Guest User', role: 'member' });
    setShowLanding(false);
  };

  // Notice handlers
  const openNoticeModal = (notice?: Notice) => {
    if (notice) {
      // Check ownership for edit
      if (user && user.role === 'admin' && notice.publishedById && notice.publishedById !== user.id) {
        toast({ 
          title: 'Access Denied', 
          description: 'You can only edit notices that you created', 
          variant: 'destructive' 
        });
        return;
      }
      const startDate = new Date(notice.startDate);
      const expiryDate = new Date(notice.expiryDate);
      setNoticeForm({
        id: notice.id,
        title: notice.title,
        description: notice.description,
        category: notice.category,
        priority: notice.priority || 'normal',
        startDate: startDate.toISOString().split('T')[0],
        startTime: startDate.toTimeString().slice(0, 5),
        expiryDate: expiryDate.toISOString().split('T')[0],
        expiryTime: expiryDate.toTimeString().slice(0, 5),
        isScheduled: notice.status === 'scheduled',
        // New fields
        image: notice.image || '',
        attachment: notice.attachment || '',
        attachmentName: notice.attachmentName || '',
        contact: notice.contact || '',
      });
    } else {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setNoticeForm({
        id: '',
        title: '',
        description: '',
        category: 'general',
        priority: 'normal',
        startDate: now.toISOString().split('T')[0],
        startTime: now.toTimeString().slice(0, 5),
        expiryDate: nextWeek.toISOString().split('T')[0],
        expiryTime: nextWeek.toTimeString().slice(0, 5),
        isScheduled: false,
        // New fields
        image: '',
        attachment: '',
        attachmentName: '',
        contact: '',
      });
    }
    setShowNoticeModal(true);
  };

  const handleSaveNotice = async () => {
    if (!noticeForm.title || !noticeForm.description) {
      toast({ title: 'Error', description: 'Title and description are required', variant: 'destructive' });
      return;
    }
    
    const startDateTime = `${noticeForm.startDate}T${noticeForm.startTime || '00:00'}`;
    const expiryDateTime = `${noticeForm.expiryDate}T${noticeForm.expiryTime || '23:59'}`;
    
    if (new Date(expiryDateTime) <= new Date(startDateTime)) {
      toast({ title: 'Error', description: 'Expiry date must be after start date', variant: 'destructive' });
      return;
    }

    try {
      const url = noticeForm.id ? `/api/notices/${noticeForm.id}` : '/api/notices';
      const method = noticeForm.id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noticeForm.title,
          description: noticeForm.description,
          category: noticeForm.category,
          priority: noticeForm.priority,
          startDate: startDateTime,
          expiryDate: expiryDateTime,
          isScheduled: noticeForm.isScheduled,
          image: noticeForm.image || null,
          attachment: noticeForm.attachment || null,
          attachmentName: noticeForm.attachmentName || null,
          contact: noticeForm.contact || null,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setShowNoticeModal(false);
        fetchAllData();
        toast({ title: noticeForm.id ? 'Notice Updated' : 'Notice Published', description: 'Success!' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save notice', variant: 'destructive' });
    }
  };

  const handleDeleteNotice = async () => {
    if (!selectedNoticeId) return;
    
    // Check ownership
    const notice = notices.find(n => n.id === selectedNoticeId) || 
                  expiredNotices.find(n => n.id === selectedNoticeId) ||
                  scheduledNotices.find(n => n.id === selectedNoticeId);
    
    if (notice && user && notice.publishedById && notice.publishedById !== user.id) {
      toast({ 
        title: 'Access Denied', 
        description: 'You can only delete notices that you created', 
        variant: 'destructive' 
      });
      setShowDeleteModal(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/notices/${selectedNoticeId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShowDeleteModal(false);
        setSelectedNoticeId(null);
        fetchAllData();
        toast({ title: 'Moved to Trash', description: 'Notice moved to trash' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete notice', variant: 'destructive' });
    }
  };

  const handleRestoreNotice = async (id: string) => {
    try {
      const res = await fetch(`/api/notices/${id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
        toast({ title: 'Restored', description: 'Notice restored successfully' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to restore notice', variant: 'destructive' });
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedNoticeId) return;
    try {
      const res = await fetch(`/api/notices/${selectedNoticeId}/permanent`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShowPermanentDeleteModal(false);
        setSelectedNoticeId(null);
        fetchAllData();
        toast({ title: 'Deleted', description: 'Notice permanently deleted' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete notice', variant: 'destructive' });
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await fetch('/api/notices/empty-trash', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShowEmptyTrashModal(false);
        fetchAllData();
        toast({ title: 'Trash Emptied', description: 'All deleted notices removed' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to empty trash', variant: 'destructive' });
    }
  };

  // Request handlers
  const handleSubmitRequest = async () => {
    if (!requestForm.title || !requestForm.description || !requestForm.requestedBy) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowRequestModal(false);
        setRequestForm({ requestedBy: '', title: '', description: '', category: 'general' });
        fetchAllData();
        toast({ title: 'Request Submitted', description: 'Your request is pending approval' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit request', variant: 'destructive' });
    }
  };

  const openPublishModal = (request: Request) => {
    setSelectedRequest(request);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setNoticeForm({
      ...noticeForm,
      id: '',
      title: request.title,
      description: request.description,
      category: request.category,
      startDate: now.toISOString().split('T')[0],
      startTime: now.toTimeString().slice(0, 5),
      expiryDate: nextWeek.toISOString().split('T')[0],
      expiryTime: nextWeek.toTimeString().slice(0, 5),
    });
    setShowPublishModal(true);
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest) return;
    const startDateTime = `${noticeForm.startDate}T${noticeForm.startTime || '00:00'}`;
    const expiryDateTime = `${noticeForm.expiryDate}T${noticeForm.expiryTime || '23:59'}`;
    
    try {
      const res = await fetch(`/api/requests/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDateTime,
          expiryDate: expiryDateTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPublishModal(false);
        setSelectedRequest(null);
        fetchAllData();
        toast({ title: 'Notice Published', description: 'Request approved and notice published' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve request', variant: 'destructive' });
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/requests/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
        toast({ title: 'Request Rejected', description: 'The request has been rejected' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject request', variant: 'destructive' });
    }
  };

  // Feedback handlers
  const handleSubmitFeedback = async () => {
    if (!feedbackForm.name || !feedbackForm.subject || !feedbackForm.message) {
      toast({ title: 'Error', description: 'Name, subject, and message are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowFeedbackModal(false);
        setFeedbackForm({ name: '', email: '', subject: '', message: '', type: 'suggestion' });
        toast({ title: 'Feedback Sent', description: 'Thank you for your feedback!' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit feedback', variant: 'destructive' });
    }
  };

  // Helpers
  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCountdown = (expiryDate: Date | string) => {
    const diff = new Date(expiryDate).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expired', isExpired: true, isWarning: false };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return {
      text: `${days}d ${hours}h ${minutes}m ${seconds}s`,
      isExpired: false,
      isWarning: diff < 24 * 60 * 60 * 1000,
    };
  };

  const getTimeUntilStart = (startDate: Date | string) => {
    const diff = new Date(startDate).getTime() - Date.now();
    if (diff <= 0) return { text: 'Starting now', isStarting: true };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return { text: `Starts in ${days}d ${hours}h`, isStarting: false };
    if (hours > 0) return { text: `Starts in ${hours}h ${minutes}m`, isStarting: false };
    return { text: `Starts in ${minutes}m`, isStarting: false };
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
      event: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      academic: 'bg-green-500/20 text-green-400 border-green-500/30',
      maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      general: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return colors[category] || colors.general;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[priority] || colors.normal;
  };

  const isBookmarked = (noticeId: string) => {
    return bookmarks.some(b => b.noticeId === noticeId);
  };

  const isAdmin = user?.role === 'admin';

  // Countdown timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  // Landing Page
  if (showLanding) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        
        <div className="relative z-10 max-w-4xl w-full">
          {/* Logo */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-2xl shadow-lg shadow-cyan-500/30 mb-6">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-foreground via-slate-200 to-slate-400 bg-clip-text text-transparent mb-3">
              Notice Board Pro
            </h1>
            <p className="text-muted-foreground text-lg tracking-wider uppercase">
              Enterprise-grade digital notice management
            </p>
          </div>

          {/* Role Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => {
                setRegisterRole('admin');
                setShowLoginModal(true);
              }}
              className="group relative p-8 bg-card/50 backdrop-blur-sm border border-border rounded-2xl text-left hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mb-6 group-hover:bg-gradient-to-br group-hover:from-cyan-400 group-hover:to-purple-600 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <Settings className="w-7 h-7 text-muted-foreground group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Administrator</h3>
                <p className="text-muted-foreground mb-6">Full access. Manage notices, approve requests, view analytics.</p>
                <div className="flex items-center justify-between text-cyan-400 font-medium">
                  <span>Login Required</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </button>

            <button
              onClick={enterAsGuest}
              className="group relative p-8 bg-card/50 backdrop-blur-sm border border-border rounded-2xl text-left hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mb-6 group-hover:bg-gradient-to-br group-hover:from-cyan-400 group-hover:to-purple-600 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <Users className="w-7 h-7 text-muted-foreground group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Guest User</h3>
                <p className="text-muted-foreground mb-6">View notices, submit requests, send feedback.</p>
                <div className="flex items-center justify-between text-cyan-400 font-medium">
                  <span>Explore Now</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Login Modal */}
        <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
          <DialogContent className="bg-popover border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-2xl">Welcome Back</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Login to access the admin dashboard
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginId">User ID</Label>
                <Input
                  id="loginId"
                  value={loginForm.userId}
                  onChange={(e) => setLoginForm({ ...loginForm, userId: e.target.value })}
                  className="bg-background border-border focus:border-cyan-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loginPass">Password</Label>
                <Input
                  id="loginPass"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="bg-background border-border focus:border-cyan-500"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                Login Securely
              </Button>
            </form>
            <div className="text-center text-slate-400 text-sm mt-4">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setShowRegisterModal(true);
                }}
                className="text-cyan-400 hover:underline"
              >
                Register here
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Register Modal */}
        <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
          <DialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create Account</DialogTitle>
              <DialogDescription className="text-slate-400">
                Register as {registerRole === 'admin' ? 'Administrator' : 'Member'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="regId">Choose User ID</Label>
                <Input
                  id="regId"
                  value={registerForm.userId}
                  onChange={(e) => setRegisterForm({ ...registerForm, userId: e.target.value })}
                  className="bg-slate-900 border-slate-600 focus:border-cyan-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regName">Name</Label>
                <Input
                  id="regName"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="bg-slate-900 border-slate-600 focus:border-cyan-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regPass">Create Password</Label>
                <Input
                  id="regPass"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="bg-slate-900 border-slate-600 focus:border-cyan-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regPassConfirm">Confirm Password</Label>
                <Input
                  id="regPassConfirm"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  className="bg-slate-900 border-slate-600 focus:border-cyan-500"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                Create Account
              </Button>
            </form>
            <div className="text-center text-slate-400 text-sm mt-4">
              Already have an account?{' '}
              <button
                onClick={() => {
                  setShowRegisterModal(false);
                  setShowLoginModal(true);
                }}
                className="text-cyan-400 hover:underline"
              >
                Login here
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col z-50 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">Notice Board</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs uppercase tracking-wider mb-3 px-3">Main</div>
          
          <button
            onClick={() => { setCurrentSection('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              currentSection === 'dashboard' ? 'bg-cyan-500 text-black font-medium' : 'hover:bg-muted hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => { setCurrentSection('all-notices'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              currentSection === 'all-notices' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>All Notices</span>
            <Badge className="ml-auto bg-slate-600 text-white">{allNotices.length}</Badge>
          </button>

          {isAdmin && (
            <>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-4 mb-3 px-3">Admin</div>
              
              <button
                onClick={() => { setCurrentSection('requests'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentSection === 'requests' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Bell className="w-5 h-5" />
                <span>Pending Requests</span>
                {requests.length > 0 && (
                  <Badge className="ml-auto bg-yellow-500 text-black">{requests.length}</Badge>
                )}
              </button>

              <button
                onClick={() => { setCurrentSection('scheduled'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentSection === 'scheduled' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <CalendarDays className="w-5 h-5" />
                <span>Scheduled</span>
                {scheduledNotices.length > 0 && (
                  <Badge className="ml-auto bg-purple-500 text-white">{scheduledNotices.length}</Badge>
                )}
              </button>

              <button
                onClick={() => { setCurrentSection('analytics'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentSection === 'analytics' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span>Analytics</span>
              </button>

              <button
                onClick={() => { setCurrentSection('feedbacks'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentSection === 'feedbacks' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Feedbacks</span>
                {feedbacks.filter(f => f.status === 'pending').length > 0 && (
                  <Badge className="ml-auto bg-orange-500 text-white">{feedbacks.filter(f => f.status === 'pending').length}</Badge>
                )}
              </button>

              <button
                onClick={() => { setCurrentSection('activity'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentSection === 'activity' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Activity className="w-5 h-5" />
                <span>Activity Log</span>
              </button>

              <button
                onClick={() => { setCurrentSection('reports'); setSidebarOpen(false); fetchReports(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentSection === 'reports' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <FileDown className="w-5 h-5" />
                <span>Reports</span>
                {reports.length > 0 && (
                  <Badge className="ml-auto bg-green-600 text-white">{reports.length}</Badge>
                )}
              </button>
            </>
          )}

          {/* Bookmarks section for all users */}
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-4 mb-3 px-3">Personal</div>
          
          <button
            onClick={() => { setCurrentSection('bookmarks'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              currentSection === 'bookmarks' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Bookmark className="w-5 h-5" />
            <span>Bookmarks</span>
            {bookmarks.length > 0 && (
              <Badge className="ml-auto bg-yellow-500 text-black">{bookmarks.length}</Badge>
            )}
          </button>

          <div className="text-xs text-slate-500 uppercase tracking-wider mt-4 mb-3 px-3">Other</div>
          
          <button
            onClick={() => { setCurrentSection('expired'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              currentSection === 'expired' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>Expired</span>
            {expiredNotices.length > 0 && (
              <Badge className="ml-auto bg-slate-600 text-white">{expiredNotices.length}</Badge>
            )}
          </button>

          {isAdmin && (
            <button
              onClick={() => { setCurrentSection('trash'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                currentSection === 'trash' ? 'bg-cyan-500 text-black font-medium' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Trash2 className="w-5 h-5" />
              <span>Trash</span>
              {deletedNotices.length > 0 && (
                <Badge className="ml-auto bg-red-500 text-white">{deletedNotices.length}</Badge>
              )}
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-center gap-2 p-2 bg-muted rounded-lg mb-3"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm text-foreground">Toggle Theme</span>
          </button>

          {user && (
            <div className="text-center text-xs text-muted-foreground mb-3">
              {isGuest ? 'Viewing as Guest' : <>Logged in as: <span className="text-cyan-400 font-medium">{user.name || user.userId}</span></>}
            </div>
          )}

          <Button onClick={isGuest ? () => { setUser(null); setShowLanding(true); } : handleLogout} variant="outline" className="w-full border-border text-foreground hover:bg-muted hover:bg-muted">
            <LogOut className="w-4 h-4 mr-2" />
            {isGuest ? 'Exit Guest' : 'Logout'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-foreground capitalize">
                {currentSection === 'all-notices' ? 'All Notices' : 
                 currentSection === 'scheduled' ? 'Scheduled Notices' :
                 currentSection === 'analytics' ? 'Analytics Dashboard' :
                 currentSection === 'feedbacks' ? 'Feedbacks' :
                 currentSection === 'reports' ? 'Reports' :
                 currentSection === 'all-notices' ? 'All Notices' :
                 currentSection.charAt(0).toUpperCase() + currentSection.slice(1)}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Real-time sync indicator */}
              {user && <SyncStatus status={syncStatus} />}
              {/* Search */}
              <div className="hidden md:flex items-center relative">
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notices..."
                  className="w-64 pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Action Buttons */}
              {isAdmin ? (
                <Button onClick={() => openNoticeModal()} className="bg-cyan-500 hover:bg-cyan-600 text-black">
                  <Plus className="w-4 h-4 mr-2" />
                  Publish Notice
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => setShowRequestModal(true)} className="bg-green-500 hover:bg-green-600 text-white">
                    <Edit className="w-4 h-4 mr-2" />
                    Submit Request
                  </Button>
                  <Button onClick={() => setShowFeedbackModal(true)} variant="outline" className="border-border text-foreground">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Feedback
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Dashboard Section */}
          {currentSection === 'dashboard' && (
            <>
              {/* Stats (Admin Only) */}
              {isAdmin && analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                  <Card className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 shadow-lg">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold dark:text-white text-gray-900">{analytics.overview.totalNotices}</div>
                        <div className="text-xs dark:text-slate-400 text-slate-500">Total Notices</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 shadow-lg">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold dark:text-white text-gray-900">{analytics.overview.activeNotices}</div>
                        <div className="text-xs dark:text-slate-400 text-slate-500">Active</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 shadow-lg">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold dark:text-white text-gray-900">{analytics.overview.totalViews}</div>
                        <div className="text-xs dark:text-slate-400 text-slate-500">Total Views</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 shadow-lg">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                        <Heart className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold dark:text-white text-gray-900">{analytics.overview.totalReactions}</div>
                        <div className="text-xs dark:text-slate-400 text-slate-500">Reactions</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 shadow-lg">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                        <Bell className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold dark:text-white text-gray-900">{analytics.overview.pendingRequests}</div>
                        <div className="text-xs dark:text-slate-400 text-slate-500">Pending Requests</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 shadow-lg">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <CalendarDays className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold dark:text-white text-gray-900">{analytics.overview.scheduledNotices}</div>
                        <div className="text-xs dark:text-slate-400 text-slate-500">Scheduled</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Trending Notices */}
              {isAdmin && analytics?.trending && analytics.trending.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-lg font-semibold text-white">Trending This Week</h2>
                  </div>
                  <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {analytics.trending.map((notice) => (
                      <Card key={notice.id} className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 shadow-lg dark:hover:border-cyan-500/50 hover:border-cyan-500/50 transition-colors">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white line-clamp-1">{notice.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {notice.weeklyViews} this week
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                {['all', 'urgent', 'event', 'academic', 'maintenance', 'general'].map((cat) => (
                  <Button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    variant={categoryFilter === cat ? 'default' : 'outline'}
                    className={categoryFilter === cat ? 'bg-cyan-500 text-black' : 'border-slate-600 text-slate-400'}
                    size="sm"
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Active Notices */}
              <section className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-semibold text-white">Active Notices</h2>
                  <Badge className="bg-cyan-500 text-black">{notices.length}</Badge>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notices.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-500">
                      No active notices
                    </div>
                  ) : (
                    notices.map((notice) => {
                      const countdown = getCountdown(notice.expiryDate);
                      return (
                        <NoticeCard
                          key={notice.id}
                          notice={notice}
                          isAdmin={isAdmin}
                          currentUserId={user?.id}
                          countdown={countdown}
                          isBookmarked={isBookmarked(notice.id)}
                          onEdit={() => openNoticeModal(notice)}
                          onDelete={() => { setSelectedNoticeId(notice.id); setShowDeleteModal(true); }}
                          onTrackView={() => trackView(notice.id)}
                          onReact={(type) => toggleReaction(notice.id, type)}
                          onToggleBookmark={() => toggleBookmark(notice.id)}
                          onOpenComments={() => openCommentsModal(notice)}
                        />
                      );
                    })
                  )}
                </div>
              </section>

              {/* Expired Notices */}
              {expiredNotices.length > 0 && (
                <section className="mb-8">
                  <Separator className="bg-slate-700 mb-6" />
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-xl font-semibold text-white">Expired Notices</h2>
                    <Badge className="bg-yellow-500 text-black">{expiredNotices.length}</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {expiredNotices.map((notice) => (
                      <NoticeCard
                        key={notice.id}
                        notice={notice}
                        isAdmin={isAdmin}
                        currentUserId={user?.id}
                        isExpired
                        isBookmarked={isBookmarked(notice.id)}
                        onEdit={() => openNoticeModal(notice)}
                        onDelete={() => { setSelectedNoticeId(notice.id); setShowDeleteModal(true); }}
                        onRestore={() => handleRestoreNotice(notice.id)}
                        onTrackView={() => trackView(notice.id)}
                        onToggleBookmark={() => toggleBookmark(notice.id)}
                        onOpenComments={() => openCommentsModal(notice)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* All Notices Section */}
          {currentSection === 'all-notices' && (
            <section>
              {/* Filters and Sort */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40 dark:bg-slate-700 dark:border-slate-600 dark:text-white bg-white border-slate-300 text-gray-900">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(value) => { setSortBy(value); }}>
                    <SelectTrigger className="w-36 dark:bg-slate-700 dark:border-slate-600 dark:text-white bg-white border-slate-300 text-gray-900">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="createdAt">Date Created</SelectItem>
                      <SelectItem value="startDate">Start Date</SelectItem>
                      <SelectItem value="expiryDate">Expiry Date</SelectItem>
                      <SelectItem value="viewCount">View Count</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                    <SelectTrigger className="w-28 dark:bg-slate-700 dark:border-slate-600 dark:text-white bg-white border-slate-300 text-gray-900">
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allNotices.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    No notices found
                  </div>
                ) : (
                  allNotices.map((notice) => {
                    const countdown = getCountdown(notice.expiryDate);
                    return (
                      <NoticeCard
                        key={notice.id}
                        notice={notice}
                        isAdmin={isAdmin}
                        currentUserId={user?.id}
                        countdown={countdown}
                        showStatus
                        isBookmarked={isBookmarked(notice.id)}
                        onEdit={() => openNoticeModal(notice)}
                        onDelete={() => { setSelectedNoticeId(notice.id); setShowDeleteModal(true); }}
                        onTrackView={() => trackView(notice.id)}
                        onReact={(type) => toggleReaction(notice.id, type)}
                        onToggleBookmark={() => toggleBookmark(notice.id)}
                        onOpenComments={() => openCommentsModal(notice)}
                      />
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* Scheduled Notices Section */}
          {currentSection === 'scheduled' && isAdmin && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <CalendarDays className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">Scheduled Notices</h2>
                <Badge className="bg-purple-500 text-white">{scheduledNotices.length}</Badge>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledNotices.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    No scheduled notices
                  </div>
                ) : (
                  scheduledNotices.map((notice) => {
                    const timeUntil = getTimeUntilStart(notice.startDate);
                    return (
                      <Card key={notice.id} className="dark:bg-slate-800 dark:border-purple-500/30 bg-white border-slate-200 shadow-lg border-l-4 dark:hover:border-purple-400/50 hover:border-purple-400 transition-colors">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg dark:text-white text-gray-900">{notice.title}</CardTitle>
                            <Badge className={`${getCategoryColor(notice.category)} text-xs`}>{notice.category}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="dark:text-slate-400 text-slate-600 text-sm line-clamp-2">{notice.description}</p>
                          
                          {/* Image Preview */}
                          {notice.image && (
                            <div className="rounded-lg overflow-hidden border border-slate-600">
                              <img 
                                src={notice.image} 
                                alt={notice.title}
                                className="w-full h-24 object-cover"
                              />
                            </div>
                          )}
                          
                          {/* Attachment & Contact */}
                          {(notice.attachment || notice.contact) && (
                            <div className="flex flex-wrap gap-2">
                              {notice.attachment && (
                                <a 
                                  href={notice.attachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded text-xs text-cyan-400"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  {notice.attachmentName || 'Attachment'}
                                </a>
                              )}
                              {notice.contact && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded text-xs text-green-400">
                                  <Phone className="w-3 h-3" />
                                  {notice.contact}
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 p-2 dark:bg-purple-500/10 bg-purple-50 rounded-lg dark:text-purple-300 text-purple-700 text-sm">
                            <Calendar className="w-4 h-4" />
                            <span>{timeUntil.text}</span>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs dark:text-slate-500 text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Start: {formatDateTime(notice.startDate)}
                            </span>
                          </div>
                        </CardContent>
                        <CardFooter className="gap-2">
                          <Button onClick={() => openNoticeModal(notice)} variant="outline" size="sm" className="flex-1 dark:border-slate-600 dark:text-slate-300 border-slate-300 text-slate-700">
                            <Edit className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          <Button onClick={() => { setSelectedNoticeId(notice.id); setShowDeleteModal(true); }} variant="outline" size="sm" className="dark:border-slate-600 dark:text-slate-300 border-slate-300 text-slate-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* Requests Section */}
          {currentSection === 'requests' && isAdmin && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Bell className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl font-semibold text-white">Publication Requests</h2>
                <Badge className="bg-yellow-500 text-black">{requests.length}</Badge>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {requests.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    No pending requests
                  </div>
                ) : (
                  requests.map((request) => (
                    <Card key={request.id} className="bg-slate-800 border-yellow-500/30 border-l-4">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg text-white">{request.title}</CardTitle>
                          <Badge className={`${getCategoryColor(request.category)} text-xs`}>{request.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-slate-400 text-sm line-clamp-3">{request.description}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <User className="w-3 h-3" />
                          <span>Requested by: {request.requestedBy}</span>
                        </div>
                        <div className="text-xs text-slate-500">{formatDateTime(request.createdAt)}</div>
                      </CardContent>
                      <CardFooter className="gap-2">
                        <Button onClick={() => openPublishModal(request)} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black" size="sm">
                          <Check className="w-4 h-4 mr-1" /> Publish
                        </Button>
                        <Button onClick={() => handleRejectRequest(request.id)} variant="destructive" size="sm">
                          <X className="w-4 h-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Analytics Section */}
          {currentSection === 'analytics' && isAdmin && analytics && (
            <section className="space-y-8">
              {/* Overview Cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300">Total Notices</span>
                      <FileText className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">{analytics.overview.totalNotices}</div>
                    <div className="text-sm text-cyan-300 mt-1">+{analytics.weekly.newNotices} this week</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300">Total Views</span>
                      <Eye className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">{analytics.overview.totalViews}</div>
                    <div className="text-sm text-green-300 mt-1">+{analytics.weekly.views} this week</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-pink-500/20 to-rose-600/20 border-pink-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300">Engagement</span>
                      <Heart className="w-5 h-5 text-pink-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">{analytics.overview.totalReactions}</div>
                    <div className="text-sm text-pink-300 mt-1">Likes & Helpfuls</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/20 to-violet-600/20 border-purple-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300">Users</span>
                      <Users className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold text-white">{analytics.overview.userCount}</div>
                    <div className="text-sm text-purple-300 mt-1">Registered users</div>
                  </CardContent>
                </Card>
              </div>

              {/* Most Viewed */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  Most Viewed Notices
                </h3>
                <div className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-slate-300">Title</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-300">Category</th>
                        <th className="text-right p-3 text-sm font-medium text-slate-300">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.mostViewed.map((notice, i) => (
                        <tr key={notice.id} className={i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50'}>
                          <td className="p-3 text-white">{notice.title}</td>
                          <td className="p-3"><Badge className={getCategoryColor(notice.category)}>{notice.category}</Badge></td>
                          <td className="p-3 text-right text-cyan-400 font-medium">{notice.viewCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notices by Category */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Notices by Category</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {analytics.noticesByCategory.map((cat) => (
                    <Card key={cat.category} className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-white">{cat.count}</div>
                        <div className="text-sm text-slate-400 capitalize">{cat.category}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Top Publishers */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Top Publishers</h3>
                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {analytics.topPublishers.map((pub, i) => (
                    <Card key={i} className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200">
                      <CardContent className="p-4 text-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold">
                          {pub.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-medium text-white">{pub.name}</div>
                        <div className="text-sm text-slate-400">{pub.count} notices</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Feedbacks Section */}
          {currentSection === 'feedbacks' && isAdmin && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-orange-400" />
                <h2 className="text-xl font-semibold text-white">User Feedbacks</h2>
                <Badge className="bg-orange-500 text-white">{feedbacks.length}</Badge>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {feedbacks.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    No feedbacks yet
                  </div>
                ) : (
                  feedbacks.map((feedback) => (
                    <Card key={feedback.id} className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg text-white">{feedback.subject}</CardTitle>
                            <div className="text-sm text-slate-400 mt-1">{feedback.name} {feedback.email && `<${feedback.email}>`}</div>
                          </div>
                          <Badge className={`${feedback.type === 'suggestion' ? 'bg-blue-500/20 text-blue-400' : 
                                             feedback.type === 'complaint' ? 'bg-red-500/20 text-red-400' :
                                             feedback.type === 'feature_request' ? 'bg-purple-500/20 text-purple-400' :
                                             'bg-green-500/20 text-green-400'}`}>
                            {feedback.type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-300">{feedback.message}</p>
                        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(feedback.createdAt)}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Expired Section */}
          {currentSection === 'expired' && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl font-semibold text-white">Expired Notices</h2>
                <Badge className="bg-yellow-500 text-black">{expiredNotices.length}</Badge>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expiredNotices.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    No expired notices
                  </div>
                ) : (
                  expiredNotices.map((notice) => (
                    <NoticeCard
                      key={notice.id}
                      notice={notice}
                      isAdmin={isAdmin}
                      currentUserId={user?.id}
                      isExpired
                      isBookmarked={isBookmarked(notice.id)}
                      onEdit={() => openNoticeModal(notice)}
                      onDelete={() => { setSelectedNoticeId(notice.id); setShowDeleteModal(true); }}
                      onRestore={() => handleRestoreNotice(notice.id)}
                      onTrackView={() => trackView(notice.id)}
                      onToggleBookmark={() => toggleBookmark(notice.id)}
                      onOpenComments={() => openCommentsModal(notice)}
                    />
                  ))
                )}
              </div>
            </section>
          )}

          {/* Bookmarks Section */}
          {currentSection === 'bookmarks' && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Bookmark className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl font-semibold dark:text-white text-gray-900">Your Bookmarks</h2>
                <Badge className="bg-yellow-500 text-black">{bookmarks.length}</Badge>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookmarks.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    No bookmarks yet. Click the bookmark icon on any notice to save it here.
                  </div>
                ) : (
                  bookmarks.map((bookmark) => (
                    <Card key={bookmark.id} className="bg-slate-800 border-yellow-500/30 border-l-4">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg text-white">{bookmark.notice?.title || 'Notice Deleted'}</CardTitle>
                          <Button
                            onClick={() => toggleBookmark(bookmark.noticeId)}
                            variant="ghost"
                            size="sm"
                            className="text-yellow-400 hover:text-yellow-300"
                          >
                            <Bookmark className="w-4 h-4 fill-current" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-400 text-sm line-clamp-2">{bookmark.notice?.description || 'This notice has been deleted'}</p>
                        <div className="text-xs text-slate-500 mt-2">
                          Bookmarked on {formatDateTime(bookmark.createdAt)}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Activity Log Section */}
          {currentSection === 'activity' && isAdmin && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-semibold dark:text-white text-gray-900">Activity Log</h2>
                <Badge className="bg-cyan-500 text-black">{activityLogs.length}</Badge>
              </div>
              <div className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                  {activityLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      No activity yet
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            log.action === 'create' ? 'bg-green-500/20 text-green-400' :
                            log.action === 'update' ? 'bg-blue-500/20 text-blue-400' :
                            log.action === 'delete' ? 'bg-red-500/20 text-red-400' :
                            log.action === 'view' ? 'bg-purple-500/20 text-purple-400' :
                            log.action === 'comment' ? 'bg-cyan-500/20 text-cyan-400' :
                            log.action === 'bookmark' ? 'bg-yellow-500/20 text-yellow-400' :
                            log.action === 'pin' ? 'bg-pink-500/20 text-pink-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {log.action === 'create' ? <Plus className="w-5 h-5" /> :
                             log.action === 'update' ? <Edit className="w-5 h-5" /> :
                             log.action === 'delete' ? <Trash2 className="w-5 h-5" /> :
                             log.action === 'view' ? <Eye className="w-5 h-5" /> :
                             log.action === 'comment' ? <MessageCircle className="w-5 h-5" /> :
                             log.action === 'bookmark' ? <Bookmark className="w-5 h-5" /> :
                             log.action === 'pin' ? <Pin className="w-5 h-5" /> :
                             <Activity className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white capitalize">{log.action}</span>
                              <span className="text-slate-500 text-sm">
                                by {log.user?.name || log.user?.userId || 'Anonymous'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 truncate">
                              {log.notice?.title || log.entityType}
                            </p>
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDateTime(log.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Trash Section */}
          {currentSection === 'trash' && isAdmin && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <h2 className="text-xl font-semibold text-white">Trash</h2>
                  <Badge className="bg-red-500 text-white">{deletedNotices.length}</Badge>
                </div>
                {deletedNotices.length > 0 && (
                  <Button onClick={() => setShowEmptyTrashModal(true)} variant="destructive" size="sm">
                    Empty Trash
                  </Button>
                )}
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deletedNotices.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    Trash is empty
                  </div>
                ) : (
                  deletedNotices.map((notice) => (
                    <Card key={notice.id} className="bg-slate-800/50 border-red-500/30 opacity-60">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg text-white">{notice.title}</CardTitle>
                          <Badge className={`${getCategoryColor(notice.category)} text-xs`}>{notice.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-400 text-sm line-clamp-2">{notice.description}</p>
                      </CardContent>
                      <CardFooter className="gap-2">
                        <Button onClick={() => handleRestoreNotice(notice.id)} variant="outline" size="sm" className="flex-1 border-slate-600 text-slate-300">
                          <RotateCcw className="w-4 h-4 mr-1" /> Restore
                        </Button>
                        <Button onClick={() => { setSelectedNoticeId(notice.id); setShowPermanentDeleteModal(true); }} variant="destructive" size="sm">
                          Delete Forever
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Reports Section */}
          {currentSection === 'reports' && isAdmin && (
            <section className="space-y-6">
              {/* Generate Report */}
              <Card className="dark:bg-slate-800/60 dark:border-slate-700 bg-white/60 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileDown className="w-5 h-5 text-green-400" />
                    Generate New Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-400 text-sm">
                    Generate a comprehensive Word (.docx) report containing all notices, events, user requests, author details, creation/edit dates and times. The file will be saved automatically to the server's <code className="text-cyan-400 bg-slate-900 px-1 rounded">download/</code> folder and you can download it from the list below.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={generateReport}
                      disabled={isGeneratingReport}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isGeneratingReport ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <FileDown className="w-4 h-4 mr-2" />
                          Generate Full Report
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={fetchReports}
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh List
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reports List */}
              <Card className="dark:bg-slate-800/60 dark:border-slate-700 bg-white/60 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Generated Reports
                    <Badge className="ml-2 bg-slate-600 text-white">{reports.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reports.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      <FileDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>No reports generated yet. Click "Generate Full Report" to create one.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reports.map((report, i) => (
                        <div key={report.name} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-8 h-8 text-blue-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-white font-medium truncate text-sm">{report.name}</p>
                              <p className="text-slate-400 text-xs mt-0.5">
                                {new Date(report.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                {' · '}
                                {(report.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <a
                            href={report.path}
                            download
                            className="ml-3 flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-md transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </main>

      {/* Notice Modal */}
      <Dialog open={showNoticeModal} onOpenChange={setShowNoticeModal}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{noticeForm.id ? 'Edit Notice' : 'Publish New Notice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={noticeForm.title}
                onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                className="bg-slate-900 border-slate-600"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={noticeForm.description}
                onChange={(e) => setNoticeForm({ ...noticeForm, description: e.target.value })}
                className="bg-slate-900 border-slate-600 min-h-24"
                required
              />
            </div>
            
            {/* Contact Field - Admin only */}
            {user && user.role === 'admin' && (
              <div className="space-y-2">
                <Label>Contact Information</Label>
                <Input
                  value={noticeForm.contact}
                  onChange={(e) => setNoticeForm({ ...noticeForm, contact: e.target.value })}
                  placeholder="Phone, email, or other contact details"
                  className="bg-slate-900 border-slate-600"
                />
              </div>
            )}
            
            {/* Image Upload - Optional */}
            <div className="space-y-2">
              <Label>Image (Optional)</Label>
              <label className="flex items-center justify-center w-full h-12 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Create instant preview URL (fast)
                      const objectUrl = URL.createObjectURL(file);
                      setNoticeForm({ ...noticeForm, image: objectUrl });
                      
                      // Convert to base64 in background (for database storage)
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNoticeForm({ ...noticeForm, image: reader.result as string });
                        URL.revokeObjectURL(objectUrl); // Clean up
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <Image className="w-4 h-4 mr-2 text-cyan-400" />
                <span className="text-sm text-slate-300">
                  {noticeForm.image ? 'Change Image' : 'Click to Upload Image'}
                </span>
              </label>
              {noticeForm.image && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-600">
                  <img 
                    src={noticeForm.image} 
                    alt="Preview" 
                    className="w-full h-32 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setNoticeForm({ ...noticeForm, image: '' })}
                    className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Attachment Upload - Optional */}
            <div className="space-y-2">
              <Label>Attachment (Optional)</Label>
              <label className="flex items-center justify-center w-full h-12 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Store filename immediately (fast)
                      setNoticeForm({ 
                        ...noticeForm, 
                        attachment: '', // Will be updated after conversion
                        attachmentName: file.name 
                      });
                      
                      // Convert to base64 in background
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNoticeForm({ 
                          ...noticeForm,
                          attachment: reader.result as string,
                          attachmentName: file.name 
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <Paperclip className="w-4 h-4 mr-2 text-cyan-400" />
                <span className="text-sm text-slate-300">
                  {noticeForm.attachmentName ? 'Change File' : 'Click to Upload Attachment'}
                </span>
              </label>
              {(noticeForm.attachment || noticeForm.attachmentName) && (
                <div className="flex items-center justify-between p-2 bg-slate-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-slate-300 truncate">{noticeForm.attachmentName || 'Attachment'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoticeForm({ ...noticeForm, attachment: '', attachmentName: '' })}
                    className="p-1 text-slate-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={noticeForm.category} onValueChange={(v) => setNoticeForm({ ...noticeForm, category: v })}>
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {['general', 'urgent', 'event', 'academic', 'maintenance'].map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-white hover:bg-slate-700">
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={noticeForm.priority} onValueChange={(v) => setNoticeForm({ ...noticeForm, priority: v })}>
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {['low', 'normal', 'high', 'urgent'].map((pri) => (
                    <SelectItem key={pri} value={pri} className="text-white hover:bg-slate-700">
                      {pri.charAt(0).toUpperCase() + pri.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Schedule Option */}
            <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
              <input
                type="checkbox"
                id="scheduleNotice"
                checked={noticeForm.isScheduled}
                onChange={(e) => setNoticeForm({ ...noticeForm, isScheduled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500"
              />
              <label htmlFor="scheduleNotice" className="text-sm text-slate-300 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Schedule for future publishing
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={noticeForm.startDate}
                  onChange={(e) => setNoticeForm({ ...noticeForm, startDate: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={noticeForm.startTime}
                  onChange={(e) => setNoticeForm({ ...noticeForm, startTime: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={noticeForm.expiryDate}
                  onChange={(e) => setNoticeForm({ ...noticeForm, expiryDate: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Time</Label>
                <Input
                  type="time"
                  value={noticeForm.expiryTime}
                  onChange={(e) => setNoticeForm({ ...noticeForm, expiryTime: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoticeModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleSaveNotice} className="bg-cyan-500 hover:bg-cyan-600 text-black">
              {noticeForm.id ? 'Update' : noticeForm.isScheduled ? 'Schedule' : 'Publish Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Modal (Guest) */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900 max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Notice Request</DialogTitle>
            <DialogDescription className="text-slate-400">
              Submit your notice details. An administrator will review and publish it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input
                value={requestForm.requestedBy}
                onChange={(e) => setRequestForm({ ...requestForm, requestedBy: e.target.value })}
                className="bg-slate-900 border-slate-600"
                placeholder="Enter your name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={requestForm.title}
                onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                className="bg-slate-900 border-slate-600"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={requestForm.description}
                onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                className="bg-slate-900 border-slate-600 min-h-24"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={requestForm.category} onValueChange={(v) => setRequestForm({ ...requestForm, category: v })}>
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {['general', 'urgent', 'event', 'academic', 'maintenance'].map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-white hover:bg-slate-700">
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} className="bg-green-500 hover:bg-green-600 text-white">
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal (Guest) */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900 max-w-md">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription className="text-slate-400">
              Share your suggestions, report issues, or request features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input
                  value={feedbackForm.name}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, name: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  value={feedbackForm.email}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={feedbackForm.type} onValueChange={(v) => setFeedbackForm({ ...feedbackForm, type: v })}>
                <SelectTrigger className="bg-slate-900 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="feedback">General Feedback</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={feedbackForm.subject}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, subject: e.target.value })}
                className="bg-slate-900 border-slate-600"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={feedbackForm.message}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                className="bg-slate-900 border-slate-600 min-h-24"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Send className="w-4 h-4 mr-2" /> Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Modal (Admin approving request) */}
      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900 max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Notice</DialogTitle>
            <DialogDescription className="text-slate-400">
              Review and set publish schedule
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="bg-slate-700/50 rounded-lg p-4 border-l-4 border-cyan-500 mb-4">
              <h4 className="font-medium text-white mb-1">{selectedRequest.title}</h4>
              <p className="text-slate-400 text-sm mb-2">{selectedRequest.description}</p>
              <p className="text-cyan-400 text-xs">Requested by: {selectedRequest.requestedBy}</p>
            </div>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date & Time</Label>
                <Input
                  type="date"
                  value={noticeForm.startDate}
                  onChange={(e) => setNoticeForm({ ...noticeForm, startDate: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
                <Input
                  type="time"
                  value={noticeForm.startTime}
                  onChange={(e) => setNoticeForm({ ...noticeForm, startTime: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date & Time</Label>
                <Input
                  type="date"
                  value={noticeForm.expiryDate}
                  onChange={(e) => setNoticeForm({ ...noticeForm, expiryDate: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
                <Input
                  type="time"
                  value={noticeForm.expiryTime}
                  onChange={(e) => setNoticeForm({ ...noticeForm, expiryTime: e.target.value })}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleApproveRequest} className="bg-cyan-500 hover:bg-cyan-600 text-black">
              Confirm & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Move to Trash</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Move this notice to trash? You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNotice} className="bg-red-500 hover:bg-red-600">Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Modal */}
      <AlertDialog open={showPermanentDeleteModal} onOpenChange={setShowPermanentDeleteModal}>
        <AlertDialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Permanent Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Permanently delete this notice? <strong>This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-red-500 hover:bg-red-600">Delete Forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Modal */}
      <AlertDialog open={showEmptyTrashModal} onOpenChange={setShowEmptyTrashModal}>
        <AlertDialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Empty Trash</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Permanently delete ALL trashed notices? <strong>This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyTrash} className="bg-red-500 hover:bg-red-600">Empty Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comments Modal */}
      <Dialog open={showCommentsModal} onOpenChange={setShowCommentsModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-cyan-400" />
              Comments
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedNoticeForComments?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {comment.user?.name?.charAt(0) || 'A'}
                    </div>
                    <span className="text-sm font-medium text-white">
                      {comment.user?.name || 'Anonymous'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm">{comment.content}</p>
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-slate-600 space-y-2">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="bg-slate-800/50 rounded p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-300">
                              {reply.user?.name || 'Anonymous'}
                            </span>
                            <span className="text-xs text-slate-600">
                              {formatDateTime(reply.createdAt)}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-700 pt-4">
            <div className="flex gap-2">
              <Input
                value={commentForm}
                onChange={(e) => setCommentForm(e.target.value)}
                placeholder="Add a comment..."
                className="bg-slate-900 border-slate-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
              />
              <Button onClick={handleSubmitComment} className="bg-cyan-500 hover:bg-cyan-600 text-black">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:text-white text-gray-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              Profile Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="bg-slate-900 border-slate-600"
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="bg-slate-900 border-slate-600"
                placeholder="your@email.com"
              />
            </div>
            <Separator className="bg-slate-700" />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Change Password
              </Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="bg-slate-900 border-slate-600"
                placeholder="Current password"
              />
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="bg-slate-900 border-slate-600"
                placeholder="New password"
              />
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="bg-slate-900 border-slate-600"
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={async () => {
              try {
                if (passwordForm.newPassword && passwordForm.newPassword !== passwordForm.confirmPassword) {
                  toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
                  return;
                }
                if (profileForm.name || profileForm.email) {
                  await fetch('/api/user', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profileForm),
                  });
                }
                if (passwordForm.newPassword) {
                  const res = await fetch('/api/user/password', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      currentPassword: passwordForm.currentPassword,
                      newPassword: passwordForm.newPassword,
                    }),
                  });
                  const data = await res.json();
                  if (!data.success) {
                    toast({ title: 'Error', description: data.error, variant: 'destructive' });
                    return;
                  }
                }
                setShowProfileModal(false);
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                toast({ title: 'Success', description: 'Profile updated' });
              } catch (error) {
                toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
              }
            }} className="bg-cyan-500 hover:bg-cyan-600 text-black">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

// Notice Card Component
function NoticeCard({ 
  notice, 
  isAdmin, 
  currentUserId, 
  countdown, 
  isExpired, 
  showStatus,
  isBookmarked,
  onEdit, 
  onDelete, 
  onRestore,
  onTrackView,
  onReact,
  onToggleBookmark,
  onTogglePin,
  onOpenComments,
}: {
  notice: Notice;
  isAdmin: boolean;
  currentUserId?: string;
  countdown?: { text: string; isExpired: boolean; isWarning: boolean };
  isExpired?: boolean;
  showStatus?: boolean;
  isBookmarked?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onTrackView: () => void;
  onReact?: (type: 'helpful' | 'like') => void;
  onToggleBookmark?: () => void;
  onTogglePin?: () => void;
  onOpenComments?: () => void;
}) {
  const hasViewedRef = useRef(false);

  useEffect(() => {
    if (!hasViewedRef.current) {
      hasViewedRef.current = true;
      onTrackView();
    }
  }, [onTrackView]);

  const canModify = isAdmin && notice.publishedById === currentUserId;
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[priority] || colors.normal;
  };

  return (
    <Card
      className={`dark:bg-slate-800 dark:border-slate-700 bg-white border-slate-200 dark:hover:border-cyan-500/50 hover:border-cyan-500/50 transition-colors border-l-4 relative ${
        isExpired ? 'dark:opacity-75 opacity-75' : ''
      } ${notice.isPinned ? 'ring-2 ring-cyan-500/50' : ''}`}
      style={{
        borderLeftColor:
          notice.category === 'urgent' ? '#ef4444' :
          notice.category === 'event' ? '#a855f7' :
          notice.category === 'academic' ? '#22c55e' :
          notice.category === 'maintenance' ? '#eab308' : '#64748b',
      }}
    >
      {/* Pin Indicator */}
      {notice.isPinned && (
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
          <Pin className="w-4 h-4 text-white" />
        </div>
      )}
      
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            {notice.title}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {notice.isEdited && (
              <Badge className="bg-slate-600 text-slate-300 text-xs">Edited</Badge>
            )}
            {showStatus && (
              <Badge className={`${notice.status === 'active' ? 'bg-green-500/20 text-green-400' : 
                                 notice.status === 'expired' ? 'bg-yellow-500/20 text-yellow-400' :
                                 notice.status === 'scheduled' ? 'bg-purple-500/20 text-purple-400' :
                                 'bg-slate-500/20 text-slate-400'}`}>
                {notice.status}
              </Badge>
            )}
            <Badge className={`${getPriorityColor(notice.priority || 'normal')} text-xs`}>{notice.priority || 'normal'}</Badge>
            <Badge className={`${getCategoryColor(notice.category)} text-xs`}>{notice.category}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-400 text-sm line-clamp-3">{notice.description}</p>
        
        {/* Image Display */}
        {notice.image && (
          <div className="rounded-lg overflow-hidden border border-slate-600">
            <img 
              src={notice.image} 
              alt={notice.title}
              className="w-full h-48 object-cover"
            />
          </div>
        )}
        
        {/* Attachment Display */}
        {notice.attachment && (
          <a 
            href={notice.attachment}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Paperclip className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-400">
              {notice.attachmentName || 'View Attachment'}
            </span>
            <Download className="w-3 h-3 text-slate-400 ml-auto" />
          </a>
        )}
        
        {/* Contact Information */}
        {notice.contact && (
          <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
            <Phone className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400">
              Contact: {notice.contact}
            </span>
          </div>
        )}
        
        {/* Countdown */}
        {countdown && !isExpired && (
          <div
            className={`flex items-center gap-2 p-2 rounded-lg text-sm font-mono ${
              countdown.isExpired ? 'bg-red-500/10 text-red-400' :
              countdown.isWarning ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-slate-700 text-cyan-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{countdown.text}</span>
          </div>
        )}

        {/* Engagement Stats */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {notice.viewCount || 0}
          </span>
          <button 
            onClick={() => onReact?.('like')} 
            className="flex items-center gap-1 hover:text-pink-400 transition-colors"
          >
            <Heart className="w-3 h-3" />
            {notice.likeCount || 0}
          </button>
          <button 
            onClick={() => onReact?.('helpful')} 
            className="flex items-center gap-1 hover:text-green-400 transition-colors"
          >
            <ThumbsUp className="w-3 h-3" />
            {notice.helpfulCount || 0}
          </button>
          <button 
            onClick={onOpenComments}
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            {notice.commentCount || 0}
          </button>
          <button 
            onClick={onToggleBookmark}
            className={`flex items-center gap-1 transition-colors ${isBookmarked ? 'text-yellow-400' : 'hover:text-yellow-400'}`}
          >
            <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {notice.publishedBy && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {notice.publishedBy.name || notice.publishedBy.userId}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDateTime(notice.createdAt)}
          </span>
        </div>

        {/* Edit Info */}
        {notice.isEdited && notice.editedAt && (
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Edit className="w-3 h-3" />
            Last edited: {formatDateTime(notice.editedAt)}
          </div>
        )}
      </CardContent>
      {isAdmin && (
        <CardFooter className="pt-0 gap-2 flex-wrap">
          {canModify ? (
            <>
              <Button onClick={onEdit} variant="outline" size="sm" className="flex-1 border-slate-600 text-slate-300">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
              {onTogglePin && (
                <Button onClick={onTogglePin} variant="outline" size="sm" className={`border-slate-600 ${notice.isPinned ? 'text-cyan-400' : 'text-slate-300'}`}>
                  <Pin className="w-4 h-4" />
                </Button>
              )}
              {isExpired && onRestore && (
                <Button onClick={onRestore} variant="outline" size="sm" className="border-slate-600 text-slate-300">
                  <RotateCcw className="w-4 h-4 mr-1" /> Restore
                </Button>
              )}
              <Button onClick={onDelete} variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <div className="text-xs text-slate-500 italic w-full text-center">
              Created by {notice.publishedBy?.name || 'another admin'}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

// Helper function
function getCategoryColor(category: string) {
  const colors: Record<string, string> = {
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    event: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    academic: 'bg-green-500/20 text-green-400 border-green-500/30',
    maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    general: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return colors[category] || colors.general;
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Import useRef
import { useRef } from 'react';
