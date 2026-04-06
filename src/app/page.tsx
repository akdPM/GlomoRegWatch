"use client";

import { useEffect, useState } from "react";
import { 
    Shield, FileText, AlertTriangle, Clock, CheckCircle2, 
    Upload, RefreshCcw, Circle, CheckCircle, Info, Calendar, ArrowRight, FileCheck 
} from "lucide-react";
import { format } from "date-fns";

type ActionItem = { task: string, owner: string, due_date: string; severity?: string; };
type Document = {
    id: string; source: string; title: string; source_url: string; pdf_url?: string; published_at: string;
    summary?: string; relevance_score?: string; why_it_matters?: string;
    action_items?: ActionItem[]; evidence_excerpt?: string; status: 'fetched' | 'analyzed' | 'reviewed';
};

export default function Dashboard() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [ingesting, setIngesting] = useState(false);
    const [creatingTickets, setCreatingTickets] = useState(false);
    const [syncingJira, setSyncingJira] = useState(false);
    const [ticketResults, setTicketResults] = useState<{key: string, url: string, task: string}[] | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Filters
    const [sourceFilter, setSourceFilter] = useState("All Sources");
    const [relevanceFilter, setRelevanceFilter] = useState("All Relevance");
    const [statusFilter, setStatusFilter] = useState("All Status");
    const [lastSync, setLastSync] = useState<string | null>(null);

    const [selectedId, setSelectedId] = useState<string | null>(null);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/documents?source=${sourceFilter}&relevance=${relevanceFilter}&status=${statusFilter}`);
            const json = await res.json();
            if (json.success) {
                setDocuments(json.data);
                if (json.last_sync) setLastSync(json.last_sync);
                if (json.data.length > 0 && !selectedId) {
                    setSelectedId(json.data[0].id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch documents", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDocuments();
    }, [sourceFilter, relevanceFilter, statusFilter]);

    const handleIngest = async () => {
        setIngesting(true);
        try {
            const res = await fetch('/api/fetch', { method: 'POST' });
            await res.json();
            await fetchDocuments();
        } catch (error) {
            console.error("Ingestion failed", error);
        }
        setIngesting(false);
    };

    const handleSyncJira = async () => {
        setSyncingJira(true);
        try {
            const res = await fetch('/api/tickets/sync', { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                if (json.updated_count > 0) {
                    showToast(`Successfully synced latest real-time status from Jira!`, 'success');
                    await fetchDocuments();
                } else {
                    showToast('Jira is completely synced. No status changes detected since last sync.', 'info');
                }
            } else {
                showToast(json.error || 'Failed to sync with Jira.', 'error');
            }
        } catch (error) {
            console.error("Jira sync failed", error);
            showToast('A network error occurred while syncing.', 'error');
        }
        setSyncingJira(false);
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: newStatus as any } : d));
        try {
            await fetch(`/api/documents/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const handleCreateTickets = async (doc: Document) => {
        if (!doc.action_items || doc.action_items.length === 0) return;
        setCreatingTickets(true);
        setTicketResults(null);
        try {
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: doc.id,
                    action_items: doc.action_items,
                    circular_title: doc.title,
                    circular_url: doc.source_url
                })
            });
            const json = await res.json();
            if (json.success) {
                setTicketResults(json.tickets);
                showToast(`Successfully created ${json.tickets.length} Jira tickets.`, 'success');
                // Refresh list so tracking starts
                fetchDocuments();
            } else {
                showToast(json.error || 'Failed to create tickets.', 'error');
            }
        } catch (err) {
            console.error('Ticket creation failed', err);
            showToast('A network error occurred creating tickets.', 'error');
        }
        setCreatingTickets(false);
    };


    const selectedDoc = documents.find(d => d.id === selectedId);

    // Derived stats
    const stats = {
        total: documents.length,
        highRelevance: documents.filter(d => {
            let s = d.relevance_score;
            if (s && s.startsWith('{')) { try { s = JSON.parse(s).label; } catch(e) {} }
            return s === 'High';
        }).length,
        unreviewed: documents.filter(d => d.status !== 'reviewed').length,
        actionItems: documents.reduce((acc, d) => acc + (d.action_items?.length || 0), 0),
        completedActionItems: documents.reduce((acc, d) => acc + (d.action_items?.filter((a: any) => ['done', 'closed', 'resolved', 'complete'].includes((a.status || '').toLowerCase())).length || 0), 0)
    };

    // Style Helpers
    const getSourceColor = (source: string) => {
        switch(source) {
            case 'FATF': return 'text-orange-600 bg-orange-100 border-orange-200';
            case 'IFSCA': return 'text-blue-600 bg-blue-100 border-blue-200';
            case 'SEBI': return 'text-purple-600 bg-purple-100 border-purple-200';
            case 'RBI': return 'text-green-800 bg-green-100 border-green-200';
            default: return 'text-gray-600 bg-gray-100 border-gray-200';
        }
    };

    const getRelevanceStyle = (scoreStr?: string) => {
        let score = scoreStr;
        if (scoreStr && scoreStr.startsWith('{')) {
            try { score = JSON.parse(scoreStr).label; } catch(e) {}
        }
        switch(score) {
            case 'High': return { pill: 'text-red-700 bg-red-100', dot: 'bg-red-500' };
            case 'Medium': return { pill: 'text-amber-700 bg-amber-100', dot: 'bg-amber-500' };
            case 'Low': return { pill: 'text-emerald-700 bg-emerald-100', dot: 'bg-emerald-500' };
            default: return { pill: 'text-gray-600 bg-gray-100', dot: 'bg-gray-400' };
        }
    };

    const formatAppDate = (dateString: string) => {
        try { return format(new Date(dateString), 'dd MMM yyyy') } 
        catch { return dateString; }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col p-4 md:p-6 lg:px-8 xl:px-12 max-w-[1600px] mx-auto relative">
            
            {/* Custom Toast Notification */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-all animate-bounce-in max-w-sm
                    ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-500/10' : 
                      toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 shadow-red-500/10' : 
                      'bg-slate-900 border-slate-700 text-white shadow-slate-900/20'}`}
                >
                    {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                    {toast.type === 'info' && <Info className="w-5 h-5 text-slate-300" />}
                    <p className="font-semibold text-sm leading-snug">{toast.message}</p>
                </div>
            )}

            {/* Header */}
            <header className="flex justify-between items-center pb-4 border-b border-gray-200 mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white p-2 rounded-xl">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">GlomoRegWatch</h1>
                        <p className="text-xs text-slate-500 font-medium">Regulatory Intelligence • GIFT City</p>
                    </div>
                </div>
                <div className="text-sm text-slate-500 flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                        <span>Last refreshed:</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {format(new Date(), 'd MMM, hh:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>Last autofetch:</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {lastSync ? format(new Date(lastSync), 'd MMM, hh:mm a') : 'Never'}</span>
                    </div>
                </div>
            </header>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="text-blue-500"><FileText className="w-6 h-6" /></div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                        <div className="text-sm font-medium text-slate-500">Total Documents</div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="text-red-500"><AlertTriangle className="w-6 h-6" /></div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{stats.highRelevance}</div>
                        <div className="text-sm font-medium text-slate-500">High Relevance</div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="text-amber-500"><Clock className="w-6 h-6" /></div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{stats.unreviewed}</div>
                        <div className="text-sm font-medium text-slate-500">Unreviewed</div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                    <div className="text-emerald-500"><CheckCircle2 className="w-8 h-8" /></div>
                    <div className="relative z-10 w-full flex flex-col justify-center">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-slate-900 leading-none">{stats.completedActionItems}</span>
                            <span className="text-sm font-bold text-slate-400">/ {stats.actionItems}</span>
                        </div>
                        <div className="text-sm font-medium text-slate-500 leading-tight mt-1">Actions Completed</div>
                    </div>
                    {/* Tiny visual progress bar at the bottom */}
                    {stats.actionItems > 0 && (
                        <div className="absolute bottom-0 left-0 h-1 bg-emerald-100 w-full">
                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(stats.completedActionItems / stats.actionItems) * 100}%` }}></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto">
                    <span className="text-gray-500 hidden sm:inline-block"><Shield className="w-4 h-4"/> Filters</span>
                    <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                        <option>All Sources</option>
                        <option>RBI</option>
                        <option>IFSCA</option>
                        <option>SEBI</option>
                        <option>FATF</option>
                    </select>
                    <select value={relevanceFilter} onChange={e => setRelevanceFilter(e.target.value)} className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                        <option>All Relevance</option>
                        <option>High Relevance</option>
                        <option>Medium Relevance</option>
                        <option>Low Relevance</option>
                        <option>Not Relevant</option>
                    </select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="All Status">All Status</option>
                        <option value="fetched">Fetched</option>
                        <option value="analyzed">Analyzed</option>
                        <option value="reviewed">Reviewed</option>
                    </select>
                </div>
                <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                    <button onClick={handleSyncJira} disabled={syncingJira} className="flex items-center gap-2 bg-white text-violet-700 border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-sm font-medium py-2 px-4 rounded-lg border transition disabled:opacity-70">
                        <CheckCircle2 className={`w-4 h-4 ${syncingJira ? 'animate-pulse' : ''}`} /> {syncingJira ? 'Syncing...' : 'Sync Jira'}
                    </button>
                    <button onClick={handleIngest} disabled={ingesting} className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider">
                        <RefreshCcw className={`w-4 h-4 ${ingesting ? 'animate-spin' : ''}`} /> {ingesting ? 'Fetching...' : 'Fetch Now'}
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 pb-10">
                
                {/* Left Sidebar - Item List */}
                <div className="w-full lg:w-[420px] flex flex-col gap-3 overflow-y-auto pr-1 pb-4 max-h-[800px] custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">Loading documents...</div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">No documents found. Click "Fetch Now".</div>
                    ) : (
                        documents.map(doc => {
                            const isSelected = selectedId === doc.id;
                            const relStyle = getRelevanceStyle(doc.relevance_score);
                            const isReviewed = doc.status === 'reviewed';
                            
                            return (
                                <div 
                                    key={doc.id}
                                    onClick={() => setSelectedId(doc.id)}
                                    className={`bg-white p-4 rounded-xl border-2 transition-all cursor-pointer shadow-sm
                                        ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}`}
                                >
                                    <div className="flex items-center gap-2 mb-3 text-xs font-semibold">
                                        <span className={`px-2 py-0.5 rounded-full border ${getSourceColor(doc.source)}`}>
                                            {doc.source}
                                        </span>
                                        {doc.relevance_score && (() => {
                                            let displayLabel = doc.relevance_score;
                                            if (doc.relevance_score.startsWith('{')) {
                                                try {
                                                    const p = JSON.parse(doc.relevance_score);
                                                    displayLabel = `${p.label} (${p.total})`;
                                                } catch(e) {}
                                            }
                                            return (
                                                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${relStyle.pill}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${relStyle.dot}`}></div>
                                                    {displayLabel}
                                                </span>
                                            );
                                        })()}
                                        <div className="flex-1"></div>
                                        <span className={`flex items-center gap-1 capitalize ${isReviewed ? 'text-emerald-500' : 'text-blue-500'}`}>
                                            {isReviewed ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                            {doc.status}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm leading-snug mb-3">
                                        {doc.title}
                                    </h3>
                                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> {formatAppDate(doc.published_at)}</span>
                                        {doc.action_items && doc.action_items.length > 0 && (
                                            <span className="text-slate-700 font-bold">{doc.action_items.length} actions</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Right Pane - Detail View */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto max-h-[800px] custom-scrollbar">
                    {selectedDoc ? (() => {
                        const relStyle = getRelevanceStyle(selectedDoc.relevance_score);
                        const isReviewed = selectedDoc.status === 'reviewed';

                        return (
                            <div className="p-6 md:p-8 flex flex-col h-full">
                                {/* Detail Header */}
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
                                        <span className={`px-2 py-0.5 rounded-full border ${getSourceColor(selectedDoc.source)}`}>
                                            {selectedDoc.source}
                                        </span>
                                        {selectedDoc.relevance_score && (() => {
                                            let displayLabel = selectedDoc.relevance_score;
                                            if (selectedDoc.relevance_score.startsWith('{')) {
                                                try {
                                                    const p = JSON.parse(selectedDoc.relevance_score);
                                                    displayLabel = `${p.label} (${p.total})`;
                                                } catch(e) {}
                                            }
                                            return (
                                                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${relStyle.pill}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${relStyle.dot}`}></div>
                                                    {displayLabel}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4 leading-tight">
                                        {selectedDoc.title}
                                    </h2>
                                    {selectedDoc.relevance_score && selectedDoc.relevance_score.startsWith('{') && (
                                        (() => {
                                            try {
                                                const pData = JSON.parse(selectedDoc.relevance_score);
                                                return (
                                                    <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Impact</span>
                                                            <span className="text-lg font-black text-slate-800">{pData.breakdown.impact}/3</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Urgency</span>
                                                            <span className="text-lg font-black text-slate-800">{pData.breakdown.urgency}/3</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scope</span>
                                                            <span className="text-lg font-black text-slate-800">{pData.breakdown.scope}/3</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confidence</span>
                                                            <span className="text-lg font-black text-slate-800">{pData.breakdown.confidence}/2</span>
                                                        </div>
                                                    </div>
                                                );
                                            } catch(e) { return null; }
                                        })()
                                    )}
                                    <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatAppDate(selectedDoc.published_at)}</span>
                                        <span className={`flex items-center gap-1 capitalize ${isReviewed ? 'text-emerald-500' : 'text-blue-500'}`}>
                                            {isReviewed ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                            {selectedDoc.status}
                                        </span>
                                        <a href={selectedDoc.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
                                            <Upload className="w-4 h-4" /> Source
                                        </a>
                                        {selectedDoc.pdf_url && selectedDoc.pdf_url !== selectedDoc.source_url && (
                                            <a href={selectedDoc.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
                                                <Upload className="w-4 h-4" /> PDF
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 my-6"></div>

                                {/* Raw Content if not analyzed */}
                                {selectedDoc.status === 'fetched' && (
                                    <div className="mb-8">
                                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 tracking-widest uppercase mb-3"><FileText className="w-4 h-4"/> Raw Feed Text</h3>
                                        <p className="text-slate-700 leading-relaxed text-sm md:text-base">
                                            {selectedDoc.summary || "Pending analysis..."}
                                        </p>
                                    </div>
                                )}

                                {/* Summary section */}
                                {selectedDoc.status !== 'fetched' && (
                                    <div className="mb-8">
                                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 tracking-widest uppercase mb-3"><FileText className="w-4 h-4"/> Summary</h3>
                                        <p className="text-slate-700 leading-relaxed text-sm md:text-base">
                                            {selectedDoc.summary || "No summary available."}
                                        </p>
                                    </div>
                                )}

                                {/* Evidence Excerpt */}
                                {selectedDoc.evidence_excerpt && (
                                    <div className="mb-8 pl-4 border-l-4 border-blue-200">
                                         <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 tracking-widest uppercase mb-2"><FileCheck className="w-4 h-4"/> Evidence Excerpt</h3>
                                         <p className="text-slate-500 italic text-sm">"{selectedDoc.evidence_excerpt}"</p>
                                    </div>
                                )}

                                {/* Why it matters */}
                                {selectedDoc.why_it_matters && (
                                    <div className="mb-8">
                                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 tracking-widest uppercase mb-3"><AlertTriangle className="w-4 h-4 text-amber-500"/> Why it matters to GlomoPay</h3>
                                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 text-slate-700 leading-relaxed text-sm md:text-base selection:bg-blue-200">
                                            {selectedDoc.why_it_matters}
                                        </div>
                                    </div>
                                )}

                                {/* Action Items */}
                                <div className="mb-8 flex-1">
                                    <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 tracking-widest uppercase mb-4"><ArrowRight className="w-4 h-4 text-emerald-500"/> Action Items ({selectedDoc.action_items?.length || 0})</h3>
                                    {selectedDoc.action_items && selectedDoc.action_items.length > 0 ? (
                                        <div className="flex flex-col gap-3">
                                            {selectedDoc.action_items.map((action, idx) => (
                                                <div key={idx} className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-white hover:bg-gray-50 transition">
                                                    <div className="mt-1">
                                                        {['done', 'closed', 'resolved', 'complete'].includes(((action as any).status || '').toLowerCase()) ? (
                                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full border-2 border-red-500"></div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`text-sm font-medium mb-2 transition-all ${
                                                            ['done', 'closed', 'resolved', 'complete'].includes(((action as any).status || '').toLowerCase()) 
                                                                ? 'text-slate-400 line-through' 
                                                                : 'text-slate-800'
                                                        }`}>
                                                            {action.severity && (
                                                                <span className={`inline-block mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider no-underline
                                                                    ${action.severity.toLowerCase() === 'high' ? 'bg-red-100 text-red-700' : action.severity.toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                    {action.severity} Priority
                                                                </span>
                                                            )}{action.task || (action as any).item}</p>
                                                        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                                                            <span className="bg-slate-100 px-2 py-1 rounded">Owner: {action.owner}</span>
                                                            <span className="bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 flex items-center gap-1"><Clock className="w-3 h-3"/> {action.due_date}</span>
                                                            {(action as any).jira_key && (
                                                                <div className="flex items-center gap-2">
                                                                    <a 
                                                                        href={(action as any).jira_url} 
                                                                        target="_blank" 
                                                                        rel="noreferrer" 
                                                                        className="bg-violet-50 text-violet-700 px-2 py-1 rounded border border-violet-200 hover:underline hover:bg-violet-100 transition-colors flex items-center gap-1"
                                                                    >
                                                                        {(action as any).jira_key}
                                                                    </a>
                                                                    {((action as any).status) && (
                                                                        <span className={`px-2 py-1 rounded border capitalize ${
                                                                            ['done', 'closed', 'resolved', 'complete'].includes(((action as any).status || '').toLowerCase())
                                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                                : ((action as any).status || '').toLowerCase() === 'in progress'
                                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                        }`}>
                                                                            {(action as any).status}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-gray-400 text-sm">No action items required.</div>
                                    )}
                                </div>

                                {/* Bottom Actions */}
                                <div className="pt-4 mt-auto flex flex-col gap-3">
                                    <div className="flex flex-wrap gap-3">
                                        {!isReviewed ? (
                                            <button 
                                                onClick={() => handleUpdateStatus(selectedDoc.id, 'reviewed')}
                                                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition flex justify-center items-center gap-2 shadow-sm shadow-blue-200"
                                            >
                                                <CheckCircle2 className="w-5 h-5"/> Mark as Reviewed
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleUpdateStatus(selectedDoc.id, 'analyzed')}
                                                className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-slate-700 font-semibold py-3 px-6 rounded-xl transition flex justify-center items-center gap-2"
                                            >
                                                <Circle className="w-5 h-5"/> Unmark Reviewed
                                            </button>
                                        )}
                                        {selectedDoc.action_items && selectedDoc.action_items.length > 0 && (
                                            !selectedDoc.action_items.some((a: any) => a.jira_key) ? (
                                                <button 
                                                    onClick={() => handleCreateTickets(selectedDoc)}
                                                    disabled={creatingTickets}
                                                    className="flex-1 sm:flex-none bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition flex justify-center items-center gap-2"
                                                >
                                                    <ArrowRight className="w-5 h-5"/> {creatingTickets ? 'Creating Tickets...' : `Create ${selectedDoc.action_items.length} Jira Ticket${selectedDoc.action_items.length > 1 ? 's' : ''}`}
                                                </button>
                                            ) : (
                                                <div className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-emerald-50 text-emerald-700 font-bold py-3 px-6 rounded-xl border border-emerald-200 shadow-sm">
                                                    <CheckCircle2 className="w-5 h-5"/> {selectedDoc.action_items.length} Active Jira Ticket{selectedDoc.action_items.length > 1 ? 's' : ''}
                                                </div>
                                            )
                                        )}
                                    </div>
                                    {ticketResults && ticketResults.length > 0 && !selectedDoc.action_items?.some((a: any) => a.jira_key) && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                            <p className="text-emerald-700 font-semibold text-sm mb-2">✅ {ticketResults.length} Jira ticket{ticketResults.length > 1 ? 's' : ''} created!</p>
                                            <div className="flex flex-wrap gap-2">
                                                {ticketResults.map(t => (
                                                    <a key={t.key} href={t.url} target="_blank" rel="noreferrer"
                                                        className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-1 rounded hover:underline">
                                                        {t.key}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 p-10">
                            <Info className="w-12 h-12 text-gray-200" />
                            <p>Select a document from the list to view details.</p>
                        </div>
                    )}
                </div>

            </div>

            {/* Custom Scrollbar CSS */}
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                @keyframes bounce-in {
                    0% { transform: translateY(-20px) scale(0.9); opacity: 0; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
            `}} />
        </div>
    );
}
