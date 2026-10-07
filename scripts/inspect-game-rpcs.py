"""Read public-build RPC constants offline. Never opens or modifies a game process."""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

try:
    from capstone import Cs, CS_ARCH_X86, CS_MODE_64
except ImportError:
    raise SystemExit("Developer tool only: install capstone==5.0.6 in an isolated Python environment.")

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("assembly", type=Path)
parser.add_argument("metadata", type=Path)
parser.add_argument("dump", type=Path, help="Offline Il2CppDumper dump.cs")
parser.add_argument("steam_manifest", type=Path)
parser.add_argument("output", type=Path, help="Evidence JSON; review before adding a protocol profile")
args = parser.parse_args()
manifest = args.steam_manifest.read_text(encoding="utf-8-sig")
def setting(name):
    match = re.search('"' + name + r'"\s*"([^"\r\n]*)"', manifest)
    return match[1] if match else None
if setting("appid") != "3767850" or setting("BetaKey") not in (None, "public"):
    raise SystemExit("Only the public Spirit Vale branch is supported; publictest is excluded.")
metadata_header = args.metadata.read_bytes()[:8]
magic, metadata_version = struct.unpack("<II", metadata_header)
if magic != 0xFAB11BAF:
    raise SystemExit("Invalid IL2CPP metadata header.")
data = args.assembly.read_bytes()
pe = struct.unpack_from("<I", data, 0x3C)[0]
if data[pe:pe+4] != b"PE\0\0" or struct.unpack_from("<H", data, pe+4)[0] != 0x8664:
    raise SystemExit("Expected a Windows x64 GameAssembly.")
sections = struct.unpack_from("<H", data, pe+6)[0]
optional = struct.unpack_from("<H", data, pe+20)[0]
def file_offset(rva):
    for index in range(sections):
        section = pe+24+optional+index*40
        size, va, raw_size, raw = struct.unpack_from("<IIII", data, section+8)
        if va <= rva < va+max(size, raw_size):
            return raw+rva-va
    raise ValueError("Invalid method RVA")
image_base = struct.unpack_from("<Q", data, pe+24+24)[0]
dump = args.dump.read_text(encoding="utf-8-sig")
sends = {}
for method, kind in [("SendTargetRpc", "targetRpc"), ("SendServerRpc", "serverRpc"), ("SendObserversRpc", "observersRpc")]:
    match = re.search(r"// RVA: 0x([0-9A-F]+).*\n\s*public void " + method + r"\(uint hash,", dump)
    if not match:
        raise SystemExit("Unverified FishNet send method: " + method)
    sends[image_base+int(match[1], 16)] = kind
disassembler = Cs(CS_ARCH_X86, CS_MODE_64)
evidence = []
for type_name in ["BaseUnitController", "PlayerController", "PlayerSave", "NetworkTransform"]:
    match = re.search(r"^public (?:abstract |sealed )?class " + type_name + r"\s*:", dump, re.M)
    if not match:
        raise SystemExit("Missing behaviour: " + type_name)
    end = dump.find("\n// Namespace:", match.end())
    body = dump[match.start():end if end >= 0 else len(dump)]
    for writer in re.finditer(r"// RVA: 0x([0-9A-F]+).*\n\s*(?:private|public) void RpcWriter___(.+?)___\d+\(", body):
        if type_name != "NetworkTransform" and writer[2] not in ["ChannelList_T", "TraverseActive", "QuitCharacter_Rpc"]:
            continue
        rva, wire_hash, resolved = int(writer[1], 16), None, False
        start = file_offset(rva)
        for instruction in disassembler.disasm(data[start:start+8000], image_base+rva):
            if instruction.mnemonic == "mov" and instruction.op_str.startswith("edx, "):
                try:
                    wire_hash = int(instruction.op_str.split(", ")[1], 0)
                except ValueError:
                    wire_hash = None
            if instruction.mnemonic == "xor" and instruction.op_str == "edx, edx":
                wire_hash = 0
            if instruction.mnemonic == "call":
                try:
                    target = int(instruction.op_str, 0)
                except ValueError:
                    target = 0
                if target in sends and wire_hash is not None:
                    evidence.append(dict(typeName=type_name, methodName=writer[2], wireHash=wire_hash,
                                         packetKind=sends[target], writerRva=hex(rva), sendRva=hex(target-image_base)))
                    resolved = True
                    break
                wire_hash = None  # EDX is volatile across calls; never infer a stale constant.
            if instruction.mnemonic == "ret":
                break
        if not resolved:
            raise SystemExit("Cannot verify writer: " + type_name + "." + writer[2])
if not any(item["methodName"] == "ChannelList_T" for item in evidence):
    raise SystemExit("No verified channel writer.")
args.output.write_text(json.dumps(dict(buildId=setting("buildid"), branch="public",
    gameAssemblySha256=hashlib.sha256(data).hexdigest(), metadataVersion=metadata_version,
    verifiedRpcs=evidence), indent=2) + "\n", encoding="utf-8")
print("Wrote", len(evidence), "verified RPC constants. Parameter/prefab layouts still require review.")
