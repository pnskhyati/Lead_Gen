import React, { useState } from 'react';
import { 
  Building2, 
  Radio, 
  Cpu, 
  Users2, 
  CreditCard, 
  Bell, 
  Sparkles, 
  Bot, 
  Send, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  FileText,
  UploadCloud
} from 'lucide-react';
import { SubCategory } from '../../types';

export interface OrganizationDocument {
  id: string;
  name: string;
  size: string;
  type?: string;
  uploadedAt?: string;
  status?: string;
}

interface SettingsViewProps {
  activeSubCategory: SubCategory;
  onNavigateSub: (sub: SubCategory) => void;
  onNotify?: (title: string, desc: string) => void;
}

export type SettingsSection = 'business' | 'ai' | 'channels' | 'automation' | 'team' | 'billing' | 'notifications';

export default function SettingsView({
  activeSubCategory,
  onNavigateSub,
  onNotify
}: SettingsViewProps) {
  // Active Section
  const initialSection: SettingsSection = 
    activeSubCategory === 'ai-knowledge' || activeSubCategory === 'ai-automation' ? 'ai' :
    activeSubCategory === 'channels' ? 'channels' :
    activeSubCategory === 'automation' ? 'automation' :
    activeSubCategory === 'team' || activeSubCategory === 'team-access' ? 'team' :
    activeSubCategory === 'billing' ? 'billing' :
    activeSubCategory === 'notifications' ? 'notifications' : 'business';

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  // Business state
  const [businessName, setBusinessName] = useState('Acme Studio');
  const [website, setWebsite] = useState('acme.com');
  const [industry, setIndustry] = useState('Interior design');
  const [location, setLocation] = useState('Pune');
  const [whatYouSell, setWhatYouSell] = useState('Residential and office interiors…');
  const [workingHours, setWorkingHours] = useState('Mon–Sat 10:00–19:00');
  const [outsideHoursPolicy, setOutsideHoursPolicy] = useState<'ai' | 'callback'>('ai');

  // AI Knowledge state
  const [toneOfVoice, setToneOfVoice] = useState('Friendly');
  const [testQuestion, setTestQuestion] = useState('');
  const [testAnswer, setTestAnswer] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Organization files linked to AI Knowledge (synced with onboarding Step 3)
  const [orgDocs, setOrgDocs] = useState<OrganizationDocument[]>(() => {
    try {
      const stored = localStorage.getItem('tecavy_org_files');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'doc-sample-1',
        name: 'Acme_Studio_Catalog_&_Pricing_2026.pdf',
        size: '2.4 MB',
        type: 'application/pdf',
        uploadedAt: 'Indexed',
        status: 'indexed'
      }
    ];
  });
  const orgFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUploadOrgDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const added: OrganizationDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const sizeStr = f.size > 1024 * 1024 
        ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(f.size / 1024)} KB`;
      added.push({
        id: `doc-${Date.now()}-${i}`,
        name: f.name,
        size: sizeStr,
        type: f.type || 'document',
        uploadedAt: 'Just now',
        status: 'indexed'
      });
    }
    const updated = [...orgDocs, ...added];
    setOrgDocs(updated);
    try {
      localStorage.setItem('tecavy_org_files', JSON.stringify(updated));
    } catch {}
    e.target.value = '';
    if (onNotify) onNotify('Files Uploaded', `Linked ${added.length} organization document(s) to AI knowledge.`);
  };

  const handleRemoveOrgDoc = (id: string) => {
    const updated = orgDocs.filter(d => d.id !== id);
    setOrgDocs(updated);
    try {
      localStorage.setItem('tecavy_org_files', JSON.stringify(updated));
    } catch {}
    if (onNotify) onNotify('Document Removed', 'Organization file removed from AI Knowledge.');
  };

  // Automation state
  const [handoffThreshold, setHandoffThreshold] = useState('50,000');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [qualifyThreshold, setQualifyThreshold] = useState(80);

  // Channels state
  const [channels, setChannels] = useState([
    { name: 'WhatsApp', handle: '+91 98201 44820', status: 'Connected', owner: 'Priya', icon: '🟢' },
    { name: 'Instagram', handle: '@acmestudio', status: 'Connected', owner: 'Aisha', icon: '🟣' },
    { name: 'Facebook', handle: 'Not connected', status: 'Disconnected', owner: '—', icon: '🔵' },
    { name: 'LinkedIn', handle: 'Not connected', status: 'Disconnected', owner: '—', icon: '🔷' },
    { name: 'Email', handle: 'hello@acme.com', status: 'Connected', owner: 'Priya', icon: '✉' }
  ]);

  // Team state
  const [team, setTeam] = useState([
    { id: 't1', name: 'You', email: 'you@acme.com', role: 'Owner' },
    { id: 't2', name: 'Priya Shah', email: 'priya@acme.com', role: 'Sales' },
    { id: 't3', name: 'Aisha Khan', email: 'aisha@acme.com', role: 'Marketing' }
  ]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Sales');

  // Test the AI sandbox handler (Page 35 spec)
  const handleTestAi = () => {
    if (!testQuestion.trim()) return;
    setIsTesting(true);
    setTimeout(() => {
      setTestAnswer(
        `"Hello! For our residential and office interiors in ${location}, projects typically start at ₹50,000. Our turnaround timeline is usually within 30 days. Would you like to schedule a discovery walkthrough with our solutions architect?"`
      );
      setIsTesting(false);
    }, 450);
  };

  const handleSave = () => {
    if (onNotify) onNotify('Settings Saved', 'Configuration and policies have been updated.');
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-[#E8E9D8] select-text font-mono">
      
      {/* Header */}
      <div className="border-b border-[rgba(169,191,165,0.2)] pb-4">
        <h1 className="serif text-3xl font-light text-white tracking-tight font-sans">
          Settings
        </h1>
        <p className="text-xs text-[#A9BFA5] mt-1 font-mono">
          Teach the AI, connect channels, calibrate qualification, and manage team access.
        </p>
      </div>

      {/* 2-Column Layout: Left Nav List + Right Settings Form (Page 35 spec) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left-hand List of Sections (Page 35 spec) */}
        <div className="lg:col-span-3 border border-[rgba(169,191,165,0.2)] bg-[#061816] rounded-[2px] p-2 space-y-1">
          {[
            { id: 'business', label: 'Business', icon: Building2 },
            { id: 'ai', label: 'AI Knowledge', icon: Sparkles },
            { id: 'channels', label: 'Channels', icon: Radio },
            { id: 'automation', label: 'Automation', icon: Cpu },
            { id: 'team', label: 'Team', icon: Users2 },
            { id: 'billing', label: 'Billing', icon: CreditCard },
            { id: 'notifications', label: 'Notifications', icon: Bell }
          ].map(sec => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveSection(sec.id as SettingsSection);
                  onNavigateSub(sec.id as SubCategory);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-[2px] text-xs transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#0D2D2A] text-white font-semibold border-l-2 border-[#A9BFA5]'
                    : 'text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Settings Content */}
        <div className="lg:col-span-9 border border-[rgba(169,191,165,0.2)] bg-[#071C1A] rounded-[2px] p-6 space-y-6">
          
          {/* ========================================================
              SECTION: BUSINESS (Page 35 spec)
             ======================================================== */}
          {activeSection === 'business' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.15)] pb-3">
                <span className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold">
                  BUSINESS PROFILE
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBusinessName('Acme Studio');
                    setIndustry('Interior design');
                    setLocation('Pune');
                    if (onNotify) onNotify('Fields Filled', 'Drafted business fields from website.');
                  }}
                  className="text-xs text-emerald-300 hover:underline cursor-pointer"
                >
                  ✦ Fill from website
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[#A9BFA5]/70 block mb-1">Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#A9BFA5]/70 block mb-1">Website</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#A9BFA5]/70 block mb-1">Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#A9BFA5]/70 block mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[#A9BFA5]/70 block mb-1">What you sell</label>
                  <textarea
                    rows={2}
                    value={whatYouSell}
                    onChange={(e) => setWhatYouSell(e.target.value)}
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[#A9BFA5]/70 block mb-1">Working hours</label>
                  <input
                    type="text"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[#A9BFA5]/70 block mb-1">Outside hours policy</label>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="policy"
                        checked={outsideHoursPolicy === 'ai'}
                        onChange={() => setOutsideHoursPolicy('ai')}
                        className="accent-emerald-400"
                      />
                      <span>AI replies 24/7</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="policy"
                        checked={outsideHoursPolicy === 'callback'}
                        onChange={() => setOutsideHoursPolicy('callback')}
                        className="accent-emerald-400"
                      />
                      <span>Auto "we'll call back"</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[rgba(169,191,165,0.15)]">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#E8E9D8] text-[#071C1A] text-xs font-semibold rounded-[2px]"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: AI KNOWLEDGE (Page 35 spec with "Test the AI")
             ======================================================== */}
          {activeSection === 'ai' && (
            <div className="space-y-5">
              <div className="border-b border-[rgba(169,191,165,0.15)] pb-3">
                <span className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold">
                  AI KNOWLEDGE — WHAT THE AI KNOWS WHEN IT TALKS TO CUSTOMERS
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)]">
                  <span>Products & services</span>
                  <span className="text-emerald-300 font-semibold">[+ Add] 3 items</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)]">
                  <span>Pricing</span>
                  <span className="text-emerald-300 font-semibold">[Upload price list] or type</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)]">
                  <span>FAQs</span>
                  <span className="text-emerald-300 font-semibold">[+ Add] 12 items</span>
                </div>

                {/* Organization Documents & Uploaded Files */}
                <div className="p-3.5 bg-[#061816] rounded border border-[rgba(169,191,165,0.25)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[#E8E9D8] font-bold text-xs uppercase tracking-wider">
                          Organization Documents & Knowledge Files
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {orgDocs.length} linked
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A9BFA5]/70 font-light mt-0.5">
                        Brochures, rate cards, and catalogs uploaded during Step 3 onboarding or directly below.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => orgFileInputRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-mono bg-[#0D2D2A] hover:bg-[#123834] border border-emerald-400/40 hover:border-emerald-400 text-emerald-300 hover:text-white rounded-[2px] transition-colors cursor-pointer flex items-center space-x-1 shrink-0"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>+ Upload Files</span>
                    </button>
                    <input
                      ref={orgFileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
                      onChange={handleUploadOrgDoc}
                      className="hidden"
                    />
                  </div>

                  {orgDocs.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {orgDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-2 bg-[#051513] border border-[rgba(169,191,165,0.2)] rounded-[2px] flex items-center justify-between text-xs transition-colors hover:border-emerald-400/40"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[#E8E9D8] font-medium truncate text-xs">
                                {doc.name}
                              </p>
                              <div className="flex items-center space-x-2 text-[10px] text-[#A9BFA5]/60 font-mono">
                                <span>{doc.size}</span>
                                <span>·</span>
                                <span className="text-emerald-400 flex items-center space-x-0.5">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Active AI Knowledge</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveOrgDoc(doc.id)}
                            className="text-[#A9BFA5]/60 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                            title="Remove document"
                            aria-label="Remove document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#A9BFA5]/60 italic font-mono py-1">
                      No organization documents uploaded yet. Click "+ Upload Files" to train the AI.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[#A9BFA5]/70 block mb-1">Tone of voice</label>
                  <select
                    value={toneOfVoice}
                    onChange={(e) => setToneOfVoice(e.target.value)}
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                  >
                    <option value="Professional">Professional</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Premium">Premium</option>
                    <option value="Conversational">Conversational</option>
                  </select>
                </div>

                <div className="p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.15)] space-y-1">
                  <p className="text-[#A9BFA5] font-semibold">AI may say:</p>
                  <p className="text-white italic">"Prices start at ₹50,000 for bespoke studio architecture."</p>
                </div>

                <div className="p-3 bg-[#061816] rounded border border-rose-500/20 space-y-1">
                  <p className="text-rose-300 font-semibold">AI must never:</p>
                  <p className="text-rose-100 italic">"Never discount beyond 10%, promise fixed delivery under 14 days, or give medical advice."</p>
                </div>

                {/* ┌ Test the AI ───────────────────────────────────┐ (Page 35 spec) */}
                <div className="p-4 rounded-[2px] bg-[#061816] border border-emerald-500/35 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs uppercase font-semibold text-emerald-400">
                      Test the AI
                    </span>
                  </div>

                  <p className="text-[11px] text-[#A9BFA5]">
                    Ask a customer question… → see the AI's instant answer live based on your business knowledge.
                  </p>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. What are your pricing packages in Pune?"
                      value={testQuestion}
                      onChange={(e) => setTestQuestion(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleTestAi(); }}
                      className="flex-1 bg-[#071C1A] border border-[rgba(169,191,165,0.3)] text-xs text-[#E8E9D8] px-3 py-2 rounded focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleTestAi}
                      className="px-4 py-2 bg-emerald-400 text-[#071C1A] font-semibold rounded text-xs cursor-pointer"
                    >
                      {isTesting ? 'Thinking...' : 'Test'}
                    </button>
                  </div>

                  {testAnswer && (
                    <div className="p-3 bg-[#071C1A] border border-emerald-500/30 rounded text-xs text-emerald-200 leading-relaxed animate-fadeIn">
                      <span className="text-[10px] text-emerald-400 block font-semibold mb-1">AI Output:</span>
                      {testAnswer}
                    </div>
                  )}
                </div>

              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[rgba(169,191,165,0.15)]">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#E8E9D8] text-[#071C1A] text-xs font-semibold rounded-[2px]"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: CHANNELS (Page 35 spec)
             ======================================================== */}
          {activeSection === 'channels' && (
            <div className="space-y-4">
              <div className="border-b border-[rgba(169,191,165,0.15)] pb-3">
                <span className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold">
                  CONNECTED CHANNELS (WHATSAPP FIRST)
                </span>
              </div>

              <div className="divide-y divide-[rgba(169,191,165,0.15)] text-xs">
                {channels.map((ch, i) => (
                  <div key={i} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span>{ch.icon}</span>
                      <div>
                        <span className="font-semibold text-white block">{ch.name}</span>
                        <span className="text-[11px] text-[#A9BFA5]/70">{ch.handle}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded ${ch.status === 'Connected' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' : 'text-[#A9BFA5]/60'}`}>
                        {ch.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNotify) onNotify('Channel Status', `Configured settings for ${ch.name}.`);
                        }}
                        className="px-3 py-1 bg-[#061816] hover:bg-[#0D2D2A] border border-[rgba(169,191,165,0.25)] rounded text-[#E8E9D8] cursor-pointer"
                      >
                        {ch.status === 'Connected' ? 'Manage' : 'Connect'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: AUTOMATION (Page 36 spec with Handoff sentence rules)
             ======================================================== */}
          {activeSection === 'automation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.15)] pb-3">
                <span className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold">
                  AUTOMATION & HANDOFF RULES
                </span>
                <span className="text-xs text-emerald-300 font-semibold cursor-pointer">[+ New rule]</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">● On: Auto-reply on all channels</span>
                    <span className="text-[11px] text-[#A9BFA5]">Last fired: 2m ago</span>
                  </div>
                  <input type="checkbox" defaultChecked className="accent-emerald-400" />
                </div>

                <div className="p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">● On: Qualify leads, Hot at score ≥ 80</span>
                    <span className="text-[11px] text-[#A9BFA5]">Last fired: 22m ago</span>
                  </div>
                  <input type="checkbox" defaultChecked className="accent-emerald-400" />
                </div>

                <div className="p-3 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">● On: Follow up after 2 days of silence</span>
                    <span className="text-[11px] text-[#A9BFA5]">Last fired: 1h ago</span>
                  </div>
                  <input type="checkbox" defaultChecked className="accent-emerald-400" />
                </div>

                {/* Handoff Sentence Rule (Page 37 spec) */}
                <div className="p-4 bg-[#061816] rounded border border-amber-500/30 space-y-2">
                  <span className="text-amber-400 font-semibold block text-[11px] uppercase">
                    Sentence Handoff Rule
                  </span>
                  <p className="text-white leading-relaxed">
                    "Hand to a human when: <span className="text-amber-300 font-semibold">customer asks for a person</span> / deal value exceeds <span className="text-amber-300 font-semibold">₹{handoffThreshold}</span> / AI confidence is low, and notify <span className="text-emerald-300 font-semibold">Sales team</span>."
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: TEAM (Page 36 spec)
             ======================================================== */}
          {activeSection === 'team' && (
            <div className="space-y-4">
              <div className="border-b border-[rgba(169,191,165,0.15)] pb-3">
                <span className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold">
                  TEAM MEMBERS & ROLES
                </span>
              </div>

              {/* Invite Form */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-white px-3 py-1.5 rounded sm:w-1/3"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-white px-3 py-1.5 rounded flex-1"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-[#061816] border border-[rgba(169,191,165,0.25)] text-xs text-white px-2 py-1.5 rounded"
                >
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Admin">Admin</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (inviteEmail) {
                      setTeam([...team, { id: `t-${Date.now()}`, name: inviteName || 'Colleague', email: inviteEmail, role: inviteRole }]);
                      setInviteName('');
                      setInviteEmail('');
                      if (onNotify) onNotify('Invite Sent', 'Colleague invited to workspace.');
                    }
                  }}
                  className="px-4 py-1.5 bg-[#E8E9D8] text-[#071C1A] text-xs font-semibold rounded cursor-pointer"
                >
                  Invite
                </button>
              </div>

              <div className="divide-y divide-[rgba(169,191,165,0.15)] text-xs pt-2">
                {team.map(m => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white block">{m.name}</span>
                      <span className="text-[11px] text-[#A9BFA5]">{m.email}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#061816] border border-[rgba(169,191,165,0.2)] text-[11px]">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: BILLING (Page 36 spec)
             ======================================================== */}
          {activeSection === 'billing' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.15)] pb-3">
                <span className="uppercase tracking-widest text-[#A9BFA5] font-semibold">
                  PLAN & USAGE
                </span>
                <span className="text-emerald-300 font-semibold cursor-pointer">[Change plan]</span>
              </div>

              <div className="p-4 bg-[#061816] rounded border border-[rgba(169,191,165,0.2)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">Plan: Growth</span>
                  <span className="text-emerald-400 font-bold">₹4,999 / month</span>
                </div>

                <div className="space-y-2 pt-2 border-t border-[rgba(169,191,165,0.1)]">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Conversations: 612 / 1,000</span>
                      <span>61%</span>
                    </div>
                    <div className="w-full bg-[#071C1A] h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full w-[61%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>AI replies: 3,140 / 5,000</span>
                      <span>63%</span>
                    </div>
                    <div className="w-full bg-[#071C1A] h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full w-[63%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Seats: 4 / 5</span>
                      <span>80%</span>
                    </div>
                    <div className="w-full bg-[#071C1A] h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full w-[80%]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[#A9BFA5] uppercase text-[10px] block font-semibold">Invoices</span>
                <div className="flex items-center justify-between p-2.5 bg-[#061816] rounded border border-[rgba(169,191,165,0.15)]">
                  <span>Sep 2026 · ₹4,999</span>
                  <span className="text-emerald-300 cursor-pointer">[PDF]</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-[#061816] rounded border border-[rgba(169,191,165,0.15)]">
                  <span>Aug 2026 · ₹4,999</span>
                  <span className="text-emerald-300 cursor-pointer">[PDF]</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: NOTIFICATIONS (Page 36 spec)
             ======================================================== */}
          {activeSection === 'notifications' && (
            <div className="space-y-4 text-xs">
              <div className="border-b border-[rgba(169,191,165,0.15)] pb-3">
                <span className="uppercase tracking-widest text-[#A9BFA5] font-semibold">
                  NOTIFICATION CHANNELS MATRIX
                </span>
              </div>

              <div className="divide-y divide-[rgba(169,191,165,0.15)]">
                <div className="grid grid-cols-12 py-2 font-semibold text-[#A9BFA5] text-[11px]">
                  <div className="col-span-6">Event</div>
                  <div className="col-span-2 text-center">In-app</div>
                  <div className="col-span-2 text-center">Email</div>
                  <div className="col-span-2 text-center">WhatsApp</div>
                </div>

                <div className="grid grid-cols-12 py-2.5 items-center">
                  <div className="col-span-6 text-white">Conversation needs me</div>
                  <div className="col-span-2 text-center"><input type="checkbox" defaultChecked className="accent-emerald-400" /></div>
                  <div className="col-span-2 text-center"><input type="checkbox" defaultChecked className="accent-emerald-400" /></div>
                  <div className="col-span-2 text-center"><input type="checkbox" defaultChecked className="accent-emerald-400" /></div>
                </div>

                <div className="grid grid-cols-12 py-2.5 items-center">
                  <div className="col-span-6 text-white">New Hot lead</div>
                  <div className="col-span-2 text-center"><input type="checkbox" defaultChecked className="accent-emerald-400" /></div>
                  <div className="col-span-2 text-center"><input type="checkbox" className="accent-emerald-400" /></div>
                  <div className="col-span-2 text-center"><input type="checkbox" defaultChecked className="accent-emerald-400" /></div>
                </div>

                <div className="grid grid-cols-12 py-2.5 items-center">
                  <div className="col-span-6 text-white">Follow-up due</div>
                  <div className="col-span-2 text-center"><input type="checkbox" defaultChecked className="accent-emerald-400" /></div>
                  <div className="col-span-2 text-center"><input type="checkbox" defaultChecked className="accent-emerald-400" /></div>
                  <div className="col-span-2 text-center"><input type="checkbox" className="accent-emerald-400" /></div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
