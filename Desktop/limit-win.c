#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <stdio.h>
// A Job Object contains descendants and applies aggregate CPU/memory limits.
// It is not a filesystem/network sandbox. See SECURITY.md.
int wmain(int argc, wchar_t **argv) {
    if (argc != 2) return 125;
    HANDLE job = CreateJobObjectW(NULL, NULL);
    if (!job) return 125;
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = {0};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_JOB_TIME | JOB_OBJECT_LIMIT_JOB_MEMORY | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
    limits.BasicLimitInformation.PerJobUserTimeLimit.QuadPart = 3LL * 10000000;
    limits.BasicLimitInformation.ActiveProcessLimit = 8;
    limits.JobMemoryLimit = 512ULL * 1024 * 1024;
    if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) return 125;
    STARTUPINFOW si = {0}; si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput=GetStdHandle(STD_INPUT_HANDLE); si.hStdOutput=GetStdHandle(STD_OUTPUT_HANDLE); si.hStdError=GetStdHandle(STD_ERROR_HANDLE);
    PROCESS_INFORMATION pi = {0};
    if (!CreateProcessW(argv[1], NULL, NULL, NULL, TRUE, CREATE_SUSPENDED | CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) return 125;
    if (!AssignProcessToJobObject(job, pi.hProcess)) {TerminateProcess(pi.hProcess,125);CloseHandle(pi.hThread);CloseHandle(pi.hProcess);CloseHandle(job);return 125;}
    ResumeThread(pi.hThread);
    DWORD wait=WaitForSingleObject(pi.hProcess,8000),code=124;
    if(wait==WAIT_TIMEOUT)TerminateJobObject(job,124);else GetExitCodeProcess(pi.hProcess,&code);
    CloseHandle(pi.hThread);CloseHandle(pi.hProcess);CloseHandle(job);
    return (int)code;
}
