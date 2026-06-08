package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestRedactTaskFileNamesForPikpak115(t *testing.T) {
	currentFile := "剧集/SomeShow.S07/E12.2160p.HDR.DV.mkv"
	task := SyncTask{
		ServiceKey:  "pikpak-115-sg2",
		TaskID:      "pikpak_115_main",
		CurrentFile: &currentFile,
		ErrorSamples: []ErrSam{{
			File:    "OST.flac.zip",
			Payload: json.RawMessage(`{"file":"OST.flac.zip","stage":"upload"}`),
		}},
		RecentFiles: []File{{Name: "E12.2160p.HDR.DV.mkv"}},
	}

	redactTaskFileNames(&task)

	if task.CurrentFile == nil || *task.CurrentFile != hiddenFileName {
		t.Fatalf("CurrentFile was not redacted: %v", task.CurrentFile)
	}
	if task.ErrorSamples[0].File != hiddenFileName {
		t.Fatalf("error sample file was not redacted: %q", task.ErrorSamples[0].File)
	}
	if task.RecentFiles[0].Name != hiddenFileName {
		t.Fatalf("recent file name was not redacted: %q", task.RecentFiles[0].Name)
	}
	if strings.Contains(string(task.ErrorSamples[0].Payload), "OST.flac.zip") {
		t.Fatalf("payload still contains raw file name: %s", task.ErrorSamples[0].Payload)
	}
}

func TestRedactEventFileNamesForPikpak115(t *testing.T) {
	taskID := "pikpak_115_main"
	fileName := "E12.2160p.HDR.DV.mkv"
	event := Event{
		ServiceKey: "pikpak-115-sg2",
		TaskID:     &taskID,
		FileName:   &fileName,
		RawPayload: json.RawMessage(`{"current_file":"E12.2160p.HDR.DV.mkv","file_name":"E12.2160p.HDR.DV.mkv","message":"ok"}`),
	}

	redactEventFileNames(&event)

	if event.FileName == nil || *event.FileName != hiddenFileName {
		t.Fatalf("event FileName was not redacted: %v", event.FileName)
	}
	if strings.Contains(string(event.RawPayload), "E12.2160p.HDR.DV.mkv") {
		t.Fatalf("event payload still contains raw file name: %s", event.RawPayload)
	}
}
