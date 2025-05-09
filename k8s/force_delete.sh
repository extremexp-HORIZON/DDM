#!/bin/bash

NAMESPACE="ddm"

echo "Cleaning up Terminating Pods and PVCs in namespace: $NAMESPACE"

# Clean up Terminating Pods
TERMINATING_PODS=$(kubectl get pods -n $NAMESPACE | grep Terminating | awk '{print $1}')

for POD in $TERMINATING_PODS; do
  echo "Removing finalizers and force-deleting pod: $POD"
  kubectl get pod "$POD" -n "$NAMESPACE" -o json | \
    jq 'del(.metadata.finalizers)' | \
    kubectl replace --raw "/api/v1/namespaces/$NAMESPACE/pods/$POD/finalize" -f -

  kubectl delete pod "$POD" -n "$NAMESPACE" --force --grace-period=0
done

# Clean up Terminating PVCs
TERMINATING_PVCS=$(kubectl get pvc -n $NAMESPACE | grep Terminating | awk '{print $1}')
for PVC in $TERMINATING_PVCS; do
  echo "Removing finalizers from PVC: $PVC"
  kubectl get pvc "$PVC" -n "$NAMESPACE" -o json | \
    jq 'del(.metadata.finalizers)' | \
    kubectl replace --raw "/api/v1/namespaces/$NAMESPACE/persistentvolumeclaims/$PVC/finalize" -f -
done

echo "Cleanup complete."

