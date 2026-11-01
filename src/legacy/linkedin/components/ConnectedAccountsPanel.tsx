import React from 'react';
import type { LinkedInUser } from '../types';
import InstagramConnect from '../../components/InstagramConnect';
import FacebookConnect from '../../components/FacebookConnect';
import XConnect from '../../components/XConnect';

interface Props {
  user: LinkedInUser | null;
  onLinkedInConnect: () => void;
  onLinkedInDisconnect: () => void;
}

export default function ConnectedAccountsPanel({
  user,
  onLinkedInConnect,
  onLinkedInDisconnect,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto space-y-4 py-6 animate-fadeIn">
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Connected accounts</h2>
        <p className="text-sm text-slate-500">
          Link platforms here once — then create and schedule from the Create tab.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-900">LinkedIn</p>
            <p className="text-xs text-slate-500 mt-0.5">Publish & schedule professional posts</p>
          </div>
          {user ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
              Connected
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>
        {user ? (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0">
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-sm font-bold text-slate-600">
                    {user.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLinkedInDisconnect}
              className="text-xs font-semibold text-slate-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors shrink-0"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLinkedInConnect}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#143630] hover:bg-[#0f2a24] transition-colors"
          >
            Connect LinkedIn
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-sm font-bold text-slate-900">Other channels</p>
        <XConnect compact />
        <InstagramConnect compact />
        <FacebookConnect compact />
      </div>
    </div>
  );
}
