#include <sys/resource.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
static void cap(int resource, rlim_t value) {
    struct rlimit r = {value,value};
    if (setrlimit(resource,&r) != 0) { fprintf(stderr,"setrlimit resource %d: ",resource); perror("limit"); exit(125); }
}
int main(int argc,char **argv) {
    if(argc!=2)return 125;
    struct rlimit cpu = {2, 3};
    if (setrlimit(RLIMIT_CPU, &cpu) != 0) { perror("CPU limit"); return 125; }
    cap(RLIMIT_FSIZE,1024*1024);
    cap(RLIMIT_NOFILE,64);
    cap(RLIMIT_CORE,0);
    execv(argv[1],argv+1);
    perror("execv");return 125;
}
